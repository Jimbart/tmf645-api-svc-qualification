import partner from '../../vendor_api/VendorEmail';

describe('List of Partner Email Addresses', () => {
  test('The Province abbreviation sholud match partners email address', async () => {
    const result = await partner('NB');
    // this is temporary email per development to avoid trigger message to partners
    expect(result.toString()).toMatch(
      'jomzsantos@gmail.com',
      'johndexter.reyes@telusinternational.com',
      'telusorders@telus.com'
    );
  });
});
