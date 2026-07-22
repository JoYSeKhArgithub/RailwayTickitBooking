import { prisma } from "../config/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/error.js";

const createSchedule = async(data)=>{
    const {trainId,departureDate} = data;
    const train = await prisma.train.findUnique({
        where: {
            id: trainId
        },
        include: {
            seats: {orderBy: {seatNumber: 'asc'}},
            route:{
                include: {
                    routeStations: {
                        include: { station: true },
                        orderBy: { sequenceNumber: 'asc' }
                    },
                },
            },
        },
    });
    if(!train) throw new NotFoundError("Train not found");
    if(!train.route) throw new BadRequestError('Train has no roiute define. create route first');
    if(train.seats.length === 0) throw new BadRequestError('Train has no seats defined.');

    const parsedDate = new Date(departureDate);
    if(isNaN(parsedDate.getTime())){
        throw new BadRequestError("Invalide departure date");
    }

    const exiting = await prisma.schedule.findUnique({
        where: {
            trainId_departureDate:{
                trainId,
                departureDate: parsedDate
            }
        }
    });
    if(exiting) throw new ConflictError('Schedule already exists');

    const schedule = await prisma.schedule.create({
        data: {
            trainId,
            departureDate: parsedDate
        }
    });

    const eventPayload = {
        schedule: schedule.id,
        trainId: train.id,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        coachName: train.coachName,
        totalSeats: train.totalSeats,
        departureDate: departureDate,
        status: schedule.status,
        seats: train.seats.map((s)=>({
            seatId: s.id,
            seatNumber: s.seatNumber,
            seatType: s.seatType,
            price: s.price
        })),
        route: train.route.routeStations.map((rs)=>({
            stationId: rs.station.id,
            stationName: rs.station.name,
            stationCode: rs.station.code,
            city: rs.station.city,
            sequenceNumber: rs.sequenceNumber,
            arrivalTime: rs.arrivalTime,
            departureTime: rs.departureTime,
            distanceFromOrigin: rs.distanceFromOrigin
        })),
    };

    //Publish event
    return schedule;
}

const getAllSchedules = async(query={})=>{
    const where = {};
    if(query.trainId) where.trainId = query.trainId;
    if(query.status) where.status = query.status;
    if(query.date) where.departureDate = new Date(query.date);

    return prisma.schedule.findMany({
        where,
        include: {
            train:{
                include:{
                    route:{
                        include:{
                            routeStations:{
                                include: {
                                    station: true
                                },
                                orderBy: {
                                    sequenceNumber: 'asc'
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: {departureDate: 'asc'}
    })
}


const cancelSchedule = async(scheduleId)=>{
    const schedule = await prisma.schedule.findUnique({
        where: {
            id: scheduleId
        }
    });
    if(!schedule) throw new NotFoundError('Schedule not found');
    const cancelStatus = await prisma.schedule.update({
        where: {
            id: scheduleId
        },
        data: {
            status: 'CANCELLED'
        },
    });
    // publish event
    return cancelStatus
}

export default {
    createSchedule,
    getAllSchedules,
    cancelSchedule
}