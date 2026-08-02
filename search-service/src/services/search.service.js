import { esClient, STATION_INDEX, TRAIN_INDEX } from "../config/elasticSearch.js";
import { logger } from "../config/logger.js";

const indexStation = async (event) => {
    const station = event.data;
    if (!station) return;

    try {
        await esClient.index({
            index: STATION_INDEX,
            id: station.id,
            document: {
                stationId: station.id,
                name: station.name,
                code: station.code,
                city: station.city,
                suggest: {
                    input: [station.name, station.code, station.city].filter(Boolean),
                    weight: 10
                },
            },
            refresh: true
        });
        logger.info(`Index Station ${station.name} (${station.code})`)
    } catch (err) {
        logger.error(`Failed to index station: ${err.message}`);
    }
}

const indexTrain = async (trainEvent) => {
    try {
        const train = trainEvent.data || trainEvent;
        if (!train) return;
        
        const seatSummary = { total: 0, LOWER: 0, MIDDLE: 0, UPPER: 0, SIDE_LOWER: 0, SIDE_UPPER: 0 };
        (train.seats || []).forEach((s) => {
            seatSummary.total++;
            if (seatSummary[s.seatType] !== undefined) seatSummary[s.seatType]++;
        });

        const doc = {
            trainId: train.id,
            trainNumber: train.trainNumber,
            trainName: train.trainName,
            route: [],
            schedules: [],
            seatSummary,
        };

        await esClient.index({
            index: TRAIN_INDEX,
            id: train.id,
            document: doc,
            refresh: true
        });
        logger.info(`Indexed bare train ${train.trainNumber}`);
    } catch (err) {
        logger.error(`Failed to index train: ${err.message}`);
    }
}

const indexTrainRoute = async (routeEvent) => {
    try {
        const { train, routeStations } = routeEvent.data || routeEvent;
        if (!train || !routeStations) return;
        const seatSummary = { total: 0, LOWER: 0, MIDDLE: 0, UPPER: 0, SIDE_LOWER: 0, SIDE_UPPER: 0 };
        (train.seats || []).forEach((s) => {
            seatSummary.total++;
            if (seatSummary[s.seatType] !== undefined) seatSummary[s.seatType]++;
        })

        const doc = {
            trainId: train.id,
            trainNumber: train.trainNumber,
            trainName: train.trainName,
            route: routeStations.map((rs) => ({
                stationId: rs.station.id,
                stationName: rs.station.name,
                stationCode: rs.station.code,
                sequenceNumber: rs.sequenceNumber,
                arrivalTime: rs.arrivalTime,
                departureTime: rs.departureTime,
                distanceFromOrigin: rs.distanceFromOrigin,
            })),
            schedules: [],
            seatSummary,
        };
        await esClient.index({
            index: TRAIN_INDEX,
            id: train.id,
            document: doc,
            refresh: true
        });

        for (const rs of routeStations) {
            await esClient.index({
                index: STATION_INDEX,
                id: rs.station.id,
                document: {
                    stationId: rs.station.id,
                    name: rs.station.name,
                    code: rs.station.code,
                    city: rs.station.city,
                    suggest: {
                        input: [rs.station.name, rs.station.code, rs.station.city].filter(Boolean),
                        weight: 10
                    }
                },
                refresh: true
            });
        }
        logger.info(`Indexed train ${train.trainNumber} with ${routeStations.length} stations`);
    } catch (err) {
        logger.error(`Failed to index train route: ${err.message}`);
    }
}

const indexTrainSchedule = async (scheduleEvent) => {
    const { scheduleId, trainId, departureDate, status, seats } = scheduleEvent.data || scheduleEvent;
    const totalSeats = seats ? seats.length : 0;
    try {
        await esClient.update({
            index: TRAIN_INDEX,
            id: trainId,
            script: {
                source:
                    `if (ctx._source.schedules == null) { ctx._source.schedules = []; }
                ctx._source.schedules.removeIf(s -> s.scheduleId == params.scheduleId);
                ctx._source.schedules.add(params.newSchedule);
                `,
                params: {
                    scheduleId,
                    newSchedule: {
                        scheduleId,
                        departureDate,
                        status,
                        available: totalSeats,
                        locked: 0,
                        booked: 0,
                    }
                }
            },
            refresh: true
        });
        logger.info(`Indexed schedule ${scheduleId} for train ${trainId}`);
    } catch (err) {
        logger.warn(`Could not index schedule for train ${trainId}: ${err.message}`);
    }
}

const cancelIndexTrainSchedule = async (event) => {
    const schedule = event.data;
    if (!schedule) return;

    try {
        await esClient.update({
            index: TRAIN_INDEX,
            id: schedule.trainId,
            script: {
                source: `
            if (ctx._source.schedules != null) {
              for (def s : ctx._source.schedules) {
                if (s.scheduleId == params.scheduleId) {
                  s.status = 'CANCELLED';
                }
              }
            }
          `,
                params: { scheduleId: schedule.id },
            },
            refresh: true,
        });
        logger.info(`Cancelled schedule ${schedule.id} for train ${schedule.trainId}`);
    } catch (err) {
        logger.warn(`Could not cancel schedule: ${err.message}`);
    }
};

const searchTrainService = async(from,to,date)=>{
    const fromStation = await resolveStation(from);
    const destinationStation = await resolveStation(to);
    if(!fromStation) return {trains: [],message: `Station ${from} not found`};
    if(!destinationStation) return {trains: [],message: `Station ${to} not found`};

    const query = {
        bool: {
            must: [
                {
                    nested: {
                        path: 'route',
                        query: {term: {'route.stationId': fromStation.stationId}},
                        inner_hits: {
                            name: 'from_station'
                        }
                    }
                },
                {
                    nested:{
                        path: 'route',
                        query: {terms: {
                            'route.stationId': destinationStation.stationId
                        }},
                        inner_hits:{
                            name: 'to_station'
                        }
                    }
                }
            ]
        }
    };
    const result = await esClient.search({
        index: TRAIN_INDEX,
        query,
        size: 50
    })

    const trains = result.hits.hits.map((x)=>{
        const src = x._score;
        const fromData = x.inner_hits.from_station.hits.hits[0]?._source;
        const toData   = x.inner_hits.to_station.hits.hits[0]?._source;
        
        if (!fromData || !toData || fromData.sequenceNumber>= toData.sequenceNumber){
            return null;
        }

        const normalLize = (d)=> new Date(d).toISOString().slice(0,10);
        let scheduleInfo = null;
        if (date && src.schedules && src.schedules.length > 0){
            scheduleInfo = src.schedules.find((z)=> z.status === 'ACTIVE' && normalLize(z.departureDate)=== date) || [];
        }
        return {
            trainId: src.trainId,
            trainNumber: src.trainNumber,
            trainName: src.trainName,
            from: {
                name: fromData.stationName,
                code: fromData.stationCode,
                departureDate: fromData.departureDate,
                stationId: fromData.stationId,
                sequenceNumber: fromData.sequenceNumber
            },
            to:{
                name: toData.stationName,
                code: toData.stationCode,
                departureDate: toData.departureDate,
                stationId: toData.stationId,
                sequenceNumber: toData.sequenceNumber
            },
            seatSummary: src.seatSummary,
            schedule: scheduleInfo
        }
    }).filter(Boolean);

    return {
        from: {resolved: fromData.name, code: fromData.code},
        to: {resolved: toData.name, code: toData.code},
        date: date || 'any',
        count: trains.length,
        trains
    }
};

const resolveStation = async(input)=>{
    const exactResult = await esClient.search({
        index: STATION_INDEX,
        query: {term: {code: input.toUpperCase()}},
        size: 1
    });
    if(exactResult.hits.hits.length>0) return exactResult.hits.hits[0]._source;
    try {
        const suggestResult = await esClient.search({
            index: STATION_INDEX,
            suggest:{
                station_suggest: {
                    prefix: input,
                    completion:{
                        field: 'suggest',
                        fuzzy: {
                            fuzziness: 'AUTO'
                        },
                        size: 1
                    }
                }
            }
        });
        const options = suggestResult.suggest?.station_suggest?.[0]?.options || [];
        if (options.length > 0) return options[0]._source;
    } catch (error) {
        logger.warn(`Suggest fallback failed: ${err.message}`);
    }

    const fuzzyResult =  await esClient.search({
        index: STATION_INDEX,
        query: {
            multi_match:{
                query: input,
                fields: ['name','city'],
                fuzziness: 'AUTO',
                prefix_length: 1
            }
        },
        size: 1
    });
    return fuzzyResult.hits.hits.length > 0 ? fuzzyResult.hits.hits[0]._source : null;
}


const autocompleteStation = async (prefix) => {
    const result = await esClient.search({
        index: STATION_INDEX,
        suggest: {
            station_suggest: {
                prefix,
                completion: {
                    field: 'suggest',
                    fuzzy: { fuzziness: 'AUTO' },
                    size: 10,
                },
            },
        },
    });

    const options = result.suggest.station_suggest[0]?.options || [];
    return options.map((o) => ({
        name: o._source.name,
        code: o._source.code,
        stationId: o._source.stationId,
    }));
};

const getAlllStations = async()=>{
    const result = await esClient.search({
        index: STATION_INDEX,
        query: {
            match_all:{}
        },
        size: 100
    })
    return result.hits.hits.map((h)=> h._source);
}

const getAllTrains = async()=>{
    const result = await esClient.search({
        index: TRAIN_INDEX,
        query: {
            match_all:{}
        },
        size: 100
    })

    return result.hits.hits.map((z)=> z._source);
}


export default {
    indexStation,
    indexTrain,
    indexTrainRoute,
    indexTrainSchedule,
    cancelIndexTrainSchedule,
    searchTrainService,
    getAlllStations,
    getAllTrains,
    autocompleteStation
}