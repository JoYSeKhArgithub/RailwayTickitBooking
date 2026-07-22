import { prisma } from "../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error.js";

const createTrain = async(data)=>{
    const {trainName,trainNumber,coachName,seats} = data;
    const existing = await prisma.train.findUnique({
        where: {
            trainNumber
        }
    });
    if(existing){
        throw new ConflictError("Train with this number is already existis");
    }
    const seatNumbers = seats.map((s)=> s.seatNumbers);

    if(new Set(seatNumbers).length !== seatNumbers.length){
        throw new BadRequestError('Duplicate seat number found')
    }
   const train =  await prisma.train.create({
        data: {
            trainNumber,
            trainName,
            coachName: coachName || 'AC',
            totalSeats: seats.length,
            seats: {
                create: seats.map((s)=>({
                    seatNumber: s.seatNumber,
                    seatType: s.seatType,
                    price: s.price
                })),
            },
        },
        include: {seats: {orderBy: {seatNumber: 'asc'}}},
    });

    // publish event

    return train;
}

const createRoute = async(data)=>{
    const { trainId, stations } = data;
    const train = await prisma.train.findUnique({
        where: {
            trainId
        }
    })

    if(!train){
        throw new NotFoundError("Train not found")
    }

    const existingRoute = await prisma.route.findUnique({
        where: {trainId}
    })

    if(existingRoute){
        throw new ConflictError("Route already exists in the train")
    }

    const stationsIds = stations.map((s)=> s.stationId);
    const exitingStation = await prisma.station.findMany({
        where: {
            id: {
                in: stationsIds
            }
        }
    });

    if (exitingStation.length !== stationsIds.length){
        throw new BadRequestError("The stations Ids are conflict check for correctrness")
    }
    const sorted = [...stations].sort((a, b) => a.sequanceNumber - b.sequanceNumber);

    for (let i = 0; i < sorted.length;i++){
        if(sorted[i].sequanceNumber !== i+1){
            throw new BadRequestError('Sequnce number is starting 1')
        }
    }
    await prisma.route.create({
        data: {
            trainId,
            routeStations: {
                create: stations.map((s)=>({
                    stationId: s.stationId,
                    sequanceNumber: s.sequanceNumber,
                    arrivalTime: s.arrivalTime,
                    departureTime: s.departureTime,
                    distanceFromOrigin: s.distanceFromOrigin
                }))
            }
        },
        include: {
            routeStations: {
                include: {station: true},
                orderBy: {sequanceNumber: 'asc'},
            },
        },
    });

    const trainWithSeats = await prisma.train.findUnique({
        where: {
            id: trainId
        },
        include: {
            seats: {
                orderBy:{
                    seatNumber: 'asc'
                }
            }
        }
    })

    // Publish event
    return route;
}

const getAllTrain = async()=>{
    return prisma.train.findMany({
        include: {
            seats: {orderBy: {seatNumber: 'asc'}},
            route:{
                include: {
                    routeStations: {
                        include: {station: true},
                        orderBy: {sequanceNumber: 'asc'}
                    }
                }
            }
        }
    })
}

const getTrainById = async(id)=>{

    const train = await prisma.train.findUnique({
        where: {id},
        include: {
            seats: {
                orderBy: {seatNumber: 'asc'}
            },
            route:{
                include:{
                    routeStations:{
                        include:{
                            station: true
                        },
                        orderBy:{
                            sequanceNumber: 'asc'
                        },
                    },
                },
            },
        },
    });

    if (!train) throw new NotFoundError('Train not found');
    return train;
}

export default { createTrain, createRoute, getAllTrain ,getTrainById}