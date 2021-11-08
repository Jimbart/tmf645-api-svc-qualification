/**
 * @jest-environment node
 */
import ShawApi from '../../vendor_api/ShawApi';

test.skip('Should get 200 response code from SHAW API callback', async () => {
  const addressRequest = [
    {
      'sel:Name': ['street'],
      'sel:Value': ['2525 Grande Allee'],
    },
    {
      'sel:Name': ['city'],
      'sel:Value': ['BOISBRIAND'],
    },
    {
      'sel:Name': ['state'],
      'sel:Value': ['QC'],
    },
    {
      'sel:Name': ['country'],
      'sel:Value': ['CA'],
    },
    {
      'sel:Name': ['zip'],
      'sel:Value': ['J7H1E3'],
    },
  ];

  const shawApi = new ShawApi();

  await shawApi.getTariffInfo(addressRequest).then((data) => {
    expect(data.statusCode).toBe(0);
  });
}, 30000);
