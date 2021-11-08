import Joi from 'joi';

const queryServiceQualificationSchema = Joi.object().keys({
  description: Joi.string().required(),
  externalId: Joi.string().required(),
  '@type': Joi.string().required(),
  searchCriteria: {
    '@type': Joi.string().required(),
    service: {
      serviceType: Joi.string().required(),
      '@type': Joi.string().required(),
      place: [
        Joi.array().items(
          Joi.object({
            id: Joi.number().required(),
            role: Joi.string().required(),
            '@type': Joi.string().required(),
          })
        ),
      ],
    },
  },
});
export default queryServiceQualificationSchema;
