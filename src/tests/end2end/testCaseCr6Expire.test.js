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
            id: '1389021',
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
// 33123
describe('Service Qualification( No Expired LpdsId )', () => {
  test('Qual Api will send email to all Vendors that has a contact mode (Email) in the Province', async () => {
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
      
        {"@referredType": "Organization", "@type": "RelatedParty", "name": "SHAW", "role": "Partner"}
    
    );  
    expect(
        response.data.serviceQualificationItem[0].qualificationResult
      ).toEqual('unqualified')        


    // validate response 2nd related party
      expect(
        response.data.serviceQualificationItem[1].service.relatedParty
      ).toEqual(
        
          {"@referredType": "Organization", "@type": "RelatedParty", "name": "EASTLINK", "role": "Partner"}
      
      );  
      expect(
          response.data.serviceQualificationItem[1].qualificationResult
        ).toEqual('unqualified')  
   

  
  }, 30000);
});
