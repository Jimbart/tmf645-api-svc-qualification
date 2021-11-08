import winston from 'winston';

process.env.NODE_ENV = 'test';
winston.remove(winston.transports.Console);
winston.remove(winston.transports);
