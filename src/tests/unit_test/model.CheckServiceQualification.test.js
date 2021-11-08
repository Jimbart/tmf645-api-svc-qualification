import model from '../../model/CheckServiceQualification';

const payload = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'true',
  provideAlternative: 'false',  
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '25511',
            role: 'Service Qualification Place',
            '@type': 'GeographicAddress',
          },
        ],
        serviceSpecification: {
          id: '1',
          href:
            'http://placeholder/off-net/serviceQualificationManagement/v4/ServiceSpecification/1',
          name: 'Off_Net_Unmanaged',
          version: '1.0',
          '@type': 'ServiceSpecification',
        },
      },
    },
  ],
};

describe('Joi Schema test', () => {
  test('It Should validate a good request payload for CheckServiceQualification model', async () => {
    const request = await model.validateAsync(payload);

    // joi validation instantSyncQualification is boolean, will throw error if field is empty
    expect(request.instantSyncQualification.toString()).toMatch('true');
  });
});
