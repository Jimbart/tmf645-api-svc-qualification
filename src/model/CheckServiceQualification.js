/* eslint-disable no-dupe-keys */
import Joi from 'joi';

const checkServiceQualificationSchema = Joi.object().keys({
  description: Joi.string().required(),
  externalId: Joi.string().required(),
  provideAlternative: Joi.boolean().when(Joi.ref('instantSyncQualification'), {
    is: Joi.boolean().valid(true),
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),
  instantSyncQualification: Joi.boolean().required(),
  relatedParty: [
    Joi.array().items(
      Joi.object({
        id: Joi.string(),
        name: Joi.string(),
        role: Joi.string(),
        '@type': Joi.string(),
        '@referredType': Joi.string(),
      })
    ),
  ],

  serviceQualificationItem: [
    Joi.array().items(
      Joi.object({
        id: Joi.number().required(),
        service: {
          serviceType: Joi.string().required(),
          place: [
            Joi.array().items(
              Joi.object({
                id: Joi.number().required(),
                role: Joi.string().required(),
                '@type': Joi.string().required(),
              })
            ),
          ],
          relatedParty: [
            Joi.array().items(
              Joi.object({
                name: Joi.string(),
                role: Joi.string(),
                '@type': Joi.string(),
                '@referredType': Joi.string(),
              })
            ),
          ],
          serviceSpecification: {
            id: Joi.number().required(),
            href: Joi.string().required(),
            name: Joi.string().required(),
            version: Joi.string().required(),
            '@type': Joi.string().required(),
          },
        },
        id: Joi.number().required(),
        service: {
          serviceType: Joi.string().required(),
          place: [
            Joi.array().items(
              Joi.object({
                id: Joi.number().required(),
                role: Joi.string().required(),
                '@type': Joi.string().required(),
              })
            ),
          ],
          relatedParty: [
            Joi.array().items(
              Joi.object({
                name: Joi.string(),
                role: Joi.string(),
                '@type': Joi.string(),
                '@referredType': Joi.string(),
              })
            ),
          ],
          serviceSpecification: {
            id: Joi.number().required(),
            href: Joi.string().required(),
            name: Joi.string().required(),
            version: Joi.string().required(),
            '@type': Joi.string().required(),
          },
        },
      })
    ),
  ],
});

export default checkServiceQualificationSchema;
