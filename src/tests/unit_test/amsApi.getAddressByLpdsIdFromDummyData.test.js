import amsgetAddressByLpdsId from '../../vendor_api/AmsApi';

describe('Calling AmsApi Test', () => {
  test('Result should match to the lpds_id query to AmsApi', async () => {
    const result = await amsgetAddressByLpdsId.getAddressByLpdsId('25511');

    expect(result.Addresses[0].referenceIds.LPDS_ID).toBe('25511');
  });
});
