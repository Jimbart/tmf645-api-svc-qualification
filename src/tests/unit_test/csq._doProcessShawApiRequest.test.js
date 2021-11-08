/* eslint-disable no-underscore-dangle */
import csq from '../../controllers/CheckServiceQualificationController';
import ShawApi from '../../vendor_api/ShawApi';

csq._doProcessShawApiRequest = jest.fn();

test('Should process and validate Shaw API request', () => {
  const shawProcessRequest = csq._doProcessShawApiRequest.mockReturnValue(
    '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><GetTariffsInfoResponse xmlns="http://sellnserve.com/"><GetTariffsInfoResult><Status><StatusCode>0</StatusCode><StatusDescription>SUCCESS</StatusDescription></Status><OutputParameterSets><OutputParameterSet><OutputParameters><OutputParameter><Name>LocationType</Name><Value>Off-Net</Value></OutputParameter><OutputParameter><Name>Coax</Name><Value/></OutputParameter><OutputParameter><Name>Fiber</Name><Value/></OutputParameter></OutputParameters></OutputParameterSet></OutputParameterSets></GetTariffsInfoResult></GetTariffsInfoResponse></soap:Body></soap:Envelope>'
  );

  const shawApi = new ShawApi();
  const shawResponse = shawApi.getParsedTariffsInfoResult(shawProcessRequest());

  const { StatusCode, StatusDescription } = shawResponse[0].Status[0];
  expect(StatusCode[0]).toMatch('0');
  expect(StatusDescription[0]).toMatch('SUCCESS');
  expect(StatusDescription[0]).not.toMatch('FAILED');
});
