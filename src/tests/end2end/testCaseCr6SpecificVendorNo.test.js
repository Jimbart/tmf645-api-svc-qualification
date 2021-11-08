/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

const request = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'false',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '3046122',
            role: 'Service Qualification Place',
            '@type': 'GeographicAddress',
          },
        ],
        relatedParty:[
            {
                "name":"Eastlink",
                "role":"Vendor",
                "@type":"RelatedParty",
                "@referredType":"Organization"
            }
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
// 3011111
describe('Service Qualification( No Footprint LpdsId with specific vendor )', () => {
  test('Qual Api will send email to specific Vendor that has a contact mode (Email) in the Province', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(201);

    // validate response header
    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'inProgress',        
      })
    );

    // validate response ist related party
    expect(
      response.data.serviceQualificationItem[0].service.relatedParty
    ).toEqual(
      
        {"@referredType": "Organization", "@type": "RelatedParty", "name": "EASTLINK", "role": "Partner"}
    
    );  
    expect(
        response.data.serviceQualificationItem[0].qualificationResult
      ).toEqual('unqualified')     



  
  }, 30000);
});
