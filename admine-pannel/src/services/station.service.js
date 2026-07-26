import { logger } from "../config/logger.js";
import { prisma } from "../config/prisma.js"
import { adminProducer } from "../kafka/adminProducer.js";
import { ConflictError, NotFoundError } from "../utils/error.js"

const createStationService = async(data)=>{
   const exitingStation = await prisma.station.findUnique({
        where: {
            code: data.code
        }
   })

   if(exitingStation){
       throw new ConflictError('Station code already exists');
   }

   const station = await prisma.station.create({
        data
   });

    logger.info('Station Created', { id: station.id, code: station.code });
    // publish event
    await adminProducer.publishStationCreated(station).catch((error)=>{
        logger.error('Failed to publish station created event', { error: err.message });
    })
    return station;
}


const getAllStations = async(page,limit,search)=>{
    const skip = (page-1) * limit;
    const where = search?{
        OR: [
            { code: { contains: search, mode: 'insensitive'}},
            { name: { contains: search, mode: 'insensitive' }},
            { city: { contains: search, mode: 'insensitive' }}
        ]
    }: {}

    const [stations,total] = await Promise.all([
        prisma.station.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                name: 'asc'
            }
        }),
        prisma.station.count({ where })
    ])

    return {stations,total};
}

const getStationById = async(stationId)=>{
    const station = await prisma.station.findUnique({
        where: {
            id: stationId
        }
    });
    if(!station){
        throw new NotFoundError('Station Not Found');
    }
    return station;
}

export default { createStationService, getStationById, getAllStations }
