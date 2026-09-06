const TATKAL_WINDOWS = [
    {startHour: 10,startMinute: 0,durationMinutes:5},
    {startHour: 11,startMinute: 0,durationMinutes: 5},
]

export const getActiveMode = (now = new Date())=>{
    const h = now.getHours();
    const m = now.getMinutes();
    const currentMinutes = h*60 + m;

    for(const w of TATKAL_WINDOWS){
        const start = w.startHour *60 + w.startMinute;
        const end = start + w.durationMinutes;
        if (currentMinutes >= start && currentMinutes <= end) return 'tatkal'
    }
    return 'normal';
}

export const tiers = {
    ip: {
        normal: {capacity: 60,refillPerSec: 1},
        tatkal: {capacity: 15,refillPerSec: 0.25}
    },
    user: {
        normal: { capacity: 300, refillPerSec: 5 },
        tatkal: { capacity: 6, refillPerSec: 0.1 }
    },
    endpoint: {
        captcha: { capacity: 60, refillPerSec: 1 },
        signup: { capacity: 5, refillPerSec: 5 / 3600 },
        otpSend: { capacity: 5, refillPerSec: 5 / 3600 },             
        otpVerify: { capacity: 10, refillPerSec: 10 / 3600 },         
        login: { capacity: 100, refillPerSec: 100 / 900 },            
        searchTrains: { capacity: 60, refillPerSec: 1 },              
        searchAutocomplete: { capacity: 120, refillPerSec: 2 },        
        availabilityCheck: { capacity: 120, refillPerSec: 2 },         
        bookingSubmit: { capacity: 1, refillPerSec: 1 / 5 },          
        payment: { capacity: 3, refillPerSec: 3 / 3600 },             
        googleAuth: { capacity: 10, refillPerSec: 10 / 900 },         
        tokenRefresh: { capacity: 20, refillPerSec: 20 / 900 },       
    }
}

export const failOpen = {
    default: true,
    search: true,
    bookingSubmit: false,
    payment: false,
    seatLock: false
}

export const waitingRoom = {
    admissionBatchSize: 200,
    admissionIntervalMs: 1000,
    admissionTokenTtlSec: 300,
    queueTtlSec: 900
}