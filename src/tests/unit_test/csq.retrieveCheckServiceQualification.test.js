import retrieveCSQ from '../../controllers/CheckServiceQualificationController';

retrieveCSQ.retrieveCheckServiceQualification = jest.fn();

describe('retrieveCheckServiceQualification CSQ method test', () => {
  test('This should vaidate a good respose from the method', async () => {
    const request = { params: { doc: 'zOdzC1dQdMltqFxghuTy' } };

    const result = await retrieveCSQ.retrieveCheckServiceQualification.mockReturnValue(
      {
        state: 'done',
        description: 'Initial Technical Eligibility',
        checkServiceQualificationDate: '11/11/2020',
        instantSyncQualification: false,
        href:
          '/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification/zOdzC1dQdMltqFxghuTy',
        effectiveQualificationDate: '11/11/2020',
        id: 'zOdzC1dQdMltqFxghuTy',
      }
    );

    const { id, state } = result();
    expect(request.params.doc).toBe(id);
    expect(state).toBe('done');
  });
});
