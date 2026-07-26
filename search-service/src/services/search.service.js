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
    } catch (error) {
        logger.error(`Failed to index station: ${err.message}`);
    }
}

const indexTrainRoute = async (routeEvent) => {
    try {
        const { train, routeStations } = routeEvent;
        if (!train || !routeStations) return;
        const seatSummary = { total: 0, LOWER: 0, MIDDLE: 0, UPPER: 0, SIDE_LOWER: 0, SIDE_UPPER: 0 };
        (train.seats || []).forEach((s) => {
            seatSummary.total++;
            if (seatSummary[s.seatType] !== undefined) seatSummary[s.seatType]++;
        })

        const doc = {
            trainId: train.id,
            trainNumber: train.trainNumber,
            trainName: trainName,
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
    } catch (error) {
        logger.error(`Failed to index station: ${err.message}`);
    }
}

const indexTrainSchedule = async (scheduleEvent) => {
    const { scheduleId, trainId, departureDate, status, seats } = scheduleEvent
    const totalSeats = seats ? seats.length : 0;
    try {
        await esClient.update({
            id: TRAIN_INDEX,
            id: trainId,
            script: {
                source:
                    ` if (ctx._source.schedules == null) { ctx._source.schedules = []; }
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
    } catch (error) {
        logger.warn(`Could not index schedule for train ${trainId}: ${err.message}`);
    }
}

const cancelindexTrainSchedule = async (event) => {
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


export default {
    indexStation,
    indexTrainRoute,
    indexTrainSchedule,
    cancelindexTrainSchedule
}