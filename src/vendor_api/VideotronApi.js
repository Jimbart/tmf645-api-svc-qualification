import {} from 'dotenv/config';
import fs from 'fs';
import soapRequest from 'easy-soap-request';
import PayloadConverter from './PayloadConverter';
import URL from '../utils/enums/UrlEnum';

const { VIDEOTRON_USERNAME, VIDEOTRON_PASSWORD } = process.env;

class VideotronApi extends PayloadConverter {
  constructor() {
    super();
    this._headers = { 'Content-Type': 'text/xml;charset=UTF-8' };
  }

  getCarrierService(searchParamValue) {
    return (async () => {
      const jsonTemplate = JSON.parse(
        fs.readFileSync(
          `${__dirname}/request_template/videotron_request_template.json`
        )
      );
      const address = searchParamValue.flatMap((row) => row.Address);
      const city = searchParamValue.flatMap((row) => row.City);
      const province = searchParamValue.flatMap((row) => row.StateCode);
      const zipcode = searchParamValue.flatMap((row) => row.Zip);
      const lat = searchParamValue.flatMap((row) => row.Latitude);
      const long = searchParamValue.flatMap((row) => row.Longitude);

      const updatedJsonTemplate = JSON.parse(
        JSON.stringify(jsonTemplate)
          .replace(/\$VIDEOTRON_USERNAME/, VIDEOTRON_USERNAME)
          .replace(/\$VIDEOTRON_PASSWORD/, VIDEOTRON_PASSWORD)
          .replace(/\$ADDRESS/, address)
          .replace(/\$CITY/, city)
          .replace(/\$PROVINCE/, province)
          .replace(/\$ZIPCODE/, zipcode)
          .replace(/\$LAT/, lat)
          .replace(/\$LONG/, long)
      );
      // console.log(
      //   'updatedJsonTemplate.....',
      //   JSON.stringify(updatedJsonTemplate, 0, 2)
      // );
      //super.setJsonObjectValue(jsonTemplate, 'LocationA', searchParamValue);

      const xmlPayload = super.parseToXml(
        JSON.stringify(updatedJsonTemplate, 0, 2)
      );

      const { response } = await soapRequest({
        url: URL.GET_CARRIER_SERVICE,
        headers: this._headers,
        xml: xmlPayload,
      });

      //return super.parseToJson(response.body);
      const myprint = super.parseToJson(response.body);
      //console.log('yoooooo', JSON.stringify(myprint, 0, 2));
      if (myprint.length !== 0) {
        return true;
      }
    })();
  }

  // getParsedCarrierServiceData(carrierService) {

  //   const envelope = carrierService['soap:Envelope'];
  //   const envelopeBody = envelope['soap:Body'];

  //   const outputSegmentList = envelopeBody.flatMap(data => data.CreateExternalSystemQuoteResponse)
  //   .flatMap(data => data.IsAvailable)
  //   // .flatMap(data => data.OutputSegmentList)
  //   // .flatMap(data => data.SegmentPE)
  //   // .flatMap(data => data.OutputParameterList)
  //   // .flatMap(data => data.ParameterDto);

  //   return outputSegmentList;
  // }
}

export default VideotronApi;
