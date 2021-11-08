/**
 * @jest-environment node
 */

import BellApi from '../../vendor_api/BellApi';

test('Should get 200 response code from BELL API callback', async () => {
  const addressRequest = [
    {
      streetNumber: ['2525'],
      streetName: ['Grande Allee'],
      streetType: ['ST'],
      municipalityCity: ['BOISBRIAND'],
      provinceOrState: ['QC'],
      postalCode: ['J7H1E3'],
    },
  ];

  // expect(1).toBe(1);
  // POST request
  const bellApi = new BellApi();

  await bellApi.getPresaleProducts(addressRequest).then((data) => {
    expect(data.statusCode).toBe(200);
  });
}, 30000);
