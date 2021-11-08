/* eslint-disable no-dupe-keys */
import Joi from 'joi';

const responseCSQmodel = Joi.object().keys({
  id: Joi.string().required(),
  href: Joi.string().required(),
  checkServiceQualificationDate: Joi.string().required(),
  description: Joi.string().required(),
  effectiveQualificationDate: Joi.string().required(),
  externalId: Joi.string().required(),
  instantSyncQualification: Joi.boolean().required(),
  state: Joi.string().required(),
  serviceQualificationItem: [
    Joi.array().items(
      // id 1
      Joi.object({
        id: Joi.number().required(),
        expirationDate: Joi.string().required(),
        state: Joi.string().required(),
        qualificationResult: Joi.string().required(),
        service: {
          serviceType: Joi.string().required(),
          place: [
            Joi.array().items(
              Joi.object({
                id: Joi.number().required(),
                role: Joi.string().required(),
                streetNr: Joi.string().required(),
                streetName: Joi.string().required(),
                streetType: Joi.string().required(),
                city: Joi.string().required(),
                stateOrProvince: Joi.string().required(),
                postcode: Joi.string().required(),
                country: Joi.string().required(),
                '@type': Joi.string().required(),
              })
            ),
          ],
          relatedParty: {
            name: Joi.string().required(),
            role: Joi.string().required(),
            '@type': Joi.string().required(),
            '@referredType': Joi.string().required(),
          },
          serviceCharacteristic: {
            name: Joi.string().required(),
            valueType: Joi.string().required(),
            value: {
              speed: Joi.string().required(),
              technology: Joi.string().required(),
            },
          },
          serviceSpecification: {
            id: Joi.number().required(),
            href: Joi.string().required(),
            name: Joi.string().required(),
            version: Joi.string().required(),
            '@type': Joi.string().required(),
          },
        }, // end of ebject
        id: Joi.number().required(),
        expirationDate: Joi.string().required(),
        state: Joi.string().required(),
        qualificationResult: Joi.string().required(),
        eligibilityunavailabilityreason: Joi.array().items(
          Joi.object({
            code: Joi.string().required(),
            label: Joi.string().required(),
          })
        ),
        service: {
          serviceType: Joi.string().required(),
          place: [
            Joi.array().items(
              Joi.object({
                id: Joi.number().required(),
                role: Joi.string().required(),
                streetNr: Joi.string().required(),
                streetName: Joi.string().required(),
                streetType: Joi.string().required(),
                city: Joi.string().required(),
                stateOrProvince: Joi.string().required(),
                postcode: Joi.string().required(),
                country: Joi.string().required(),
                '@type': Joi.string().required(),
              })
            ),
          ],
          relatedParty: {
            name: Joi.string(),
            role: Joi.string(),
            '@type': Joi.string(),
            '@referredType': Joi.string(),
          },
          serviceCharacteristic: Joi.array().items(
            Joi.object({
              name: Joi.string().required(),
              valueType: Joi.string().required(),
              value: {
                speed: Joi.string().required(),
                technology: Joi.string().required(),
              },
            })
          ),
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

export default responseCSQmodel;
