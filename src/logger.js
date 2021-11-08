import { transports, createLogger, format } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'user-service' },
  transports: [new transports.Console({ format: format.simple() })],
});

if (process.env.NODE_ENV !== 'test') {
  logger.add(
    new transports.File({
      filename: 'error.log',
      level: 'error',
      timestamp: true,
    })
  );
  logger.add(
    new transports.File({ filename: 'combined.log', timestamp: true })
  );
}

export default logger;
