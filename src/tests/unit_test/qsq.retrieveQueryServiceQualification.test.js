import testRetrieveQsq from '../../controllers/QueryServiceQualificationController';

testRetrieveQsq.retrieveQueryServiceQualification = jest.fn();

describe('Test retrieveQueryServiceQualification method in QSQ', () => {
  test('This should mock a good response from the method', async () => {
    const request = { params: { doc: 'y2kFMIoGu5xHzSp7gj5y' } };
    const result = await testRetrieveQsq.retrieveQueryServiceQualification.mockReturnValue(
      {
        state: 'done',
        externalId: '6161:SQ101',
        href:
          '/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification/y2kFMIoGu5xHzSp7gj5y',
        effectiveQualificationDate: '11/10/2020',
        description: 'Initial Technical 111111',
        id: 'y2kFMIoGu5xHzSp7gj5y',
      }
    );

    const { id, externalId } = result();
    expect(request.params.doc).toBe(id);
    expect(externalId).toBe('6161:SQ101');
  });
});
