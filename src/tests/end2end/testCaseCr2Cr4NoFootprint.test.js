/* eslint-disable jest/valid-expect-in-promise */
import axios from 'axios';
import config from '../../config';
import endToEndSetup from './setup/endToEnd.setup';

endToEndSetup.initServer();

const request = {
  description: 'Initial Technical Eligibility',
  externalId: '6161:SQ101',
  instantSyncQualification: 'true',
  serviceQualificationItem: [
    {
      id: '1',
      service: {
        serviceType: 'business',
        place: [
          {
            id: '23770688',
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
describe('ON-Net Service Qualification( No FootPrint LpdsId )', () => {
  test('Qual Api will return a good response and will NOT expire when lpdsId found in On-Net database', async () => {
    const response = await axios.post(
      `${config.URL_PATH}:${config.URL_PORT}/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification`,
      request
    );

    expect(response.status).toBe(200);

    // validate response header
    expect(response.data).toEqual(
      expect.objectContaining({
        state: 'done',        
      })
    );

    // validate response related party
    expect(
      response.data.serviceQualificationItem[0].relatedParty
    ).toEqual(
      expect.objectContaining({
        name: 'Shaw',
        role: 'Partner',
      })
    );

    // validate response serviceCharacteristic value
    expect(
        response.data.serviceQualificationItem[0].serviceCharacteristic[0]
          .name
      ).toEqual(
         "Shaw Wholesale Business Internet 20x4"        
      );

    expect(
      response.data.serviceQualificationItem[0].serviceCharacteristic[0]
        .value
    ).toEqual(
      
        {"speed": "20/4 Mbps", "technology": "Unknown"}
      
    );
    expect(
        response.data.serviceQualificationItem[0].serviceCharacteristic[1]
          .name
      ).toEqual(
         "Shaw Wholesale Business Internet 75x15"        
      );

      expect(
        response.data.serviceQualificationItem[0].serviceCharacteristic[2]
          .name
      ).toEqual(
         "Shaw - Wholesale Business Internet 300x20"        
      );

      expect(
        response.data.serviceQualificationItem[0].serviceCharacteristic[3]
          .name
      ).toEqual(
         "Shaw Wholesale Business Internet 600"        
      );

      expect(
        response.data.serviceQualificationItem[0].serviceCharacteristic[4]
          .name
      ).toEqual(
         "Shaw Wholesale Business Internet 1G"        
      );


    expect(response.data.serviceQualificationItem[0].serviceSpecification).toEqual(       
        {"id": "1" , "href": "http://placeholder/catalog/off-net/services/1","name": "On-Net Location", "version": "1.0",'@type': "ServiceSpecification" }                
      );

    // response assertion

    expect(
      response.data.serviceQualificationItem[0].service.place[0]
    ).not.toEqual(
      expect.objectContaining({
        schoolid: '25511xxx',
        county: 'Torontoxxx ',
        zip: 'M5E1Z9xx',
      })
    );
  }, 30000);
});
