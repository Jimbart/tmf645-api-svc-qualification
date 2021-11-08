import testModel from '../../model/QueryServiceQualification';

const payload = {
  description: 'Initial Technical 111111',
  externalId: '6161:SQ101',
  '@type': 'QueryServiceQualification',
  searchCriteria: {
    '@type': 'ServiceQualificationItem',
    service: {
      serviceType: 'business',
      '@type': 'Service',
      place: [
        {
          id: '3059021',
          role: 'Service Qualification Place',
          '@type': 'GeographicAddress',
        },
      ],
    },
  },
};

describe('Joi Schema test', () => {
  test('It Should validate a good request payload for QueryServiceQualification model', async () => {
    const request = await testModel.validateAsync(payload);

    // joi validation , will throw eror if field is empty
    expect(request.externalId.toString()).toBe('6161:SQ101');
  });
});
