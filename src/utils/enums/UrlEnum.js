/**
 * Enum for URLs.
 * @readonly
 * @enum {string}
 */
const URL = Object.freeze({
  POST_CHECK_SERVICE_QUAL:
    '/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification',
  GET_CHECK_SERVICE_QUAL:
    '/placeholder/off-net/serviceQualificationManagement/v4/checkServiceQualification/:doc',
  POST_QUERY_SERVICE_QUAL:
    '/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification',
  GET_QUERY_SERVICE_QUAL:
    '/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification/:doc',

  // SHAW_API
  GET_TARIFFS_INFO:
    'https://nda-t6e.ndacorp.com/amsgptariffshelper/tariffshelper.asmx',

  // BELL_API
  GET_PRESALE_PRODUCTS: 'https://businessapi.bell.ca/getPresaleProducts',

  // VIDEOTRON_API
  // GET_CARRIER_SERVICE: 'https://telus-test.ndacorp.com/ams.net/ams_ws/Quotes/QuoteWS.asmx?wsdl',
  GET_CARRIER_SERVICE:
    'https://nda-t6e.ndacorp.com/ams_gp_4.0/AMS_WS/PricingAPI/PricingAPIWS.asmx',

  // AMS
  GET_AMS_TOKEN: 'https://apigw-st.telus.com/st/token',
  GET_ADDRESS_BY_ID:
    'https://apigw-st.telus.com/common/spatialnetAddressManagement/v1/address',

  // Vendor Email
  TELUS_EXCHANGE: 'telusorders@telus.com',
  EMAIL_SUBJECT: 'Check Service Qualification',
  EMAIL_TEXT:
    'Hello, Would it be possible to kindly prequalify the addresses listed in the attached document?',
  EMAIL_HTML:
    '<strong>Hello,<br /><br /> Would it be possible to kindly prequalify the addresses listed in the attached document?<br /><br /></strong>',

  // MailSlurp Credentials
  MAILSLURP_APIKEY:
    '2d111ce33f9c695292b0559532b1a74b9d7bf781c6bd88b97116415eb4fe02bc',
  MAILSLURP_INBOX: 'c59c3cad-aff0-414e-830b-8aa601bb0f19',
  MAILSLURP_EMAIL_ADDRESS: 'c59c3cad-aff0-414e-830b-8aa601bb0f19@mailslurp.com',

  CONFIG_STRING_1000:
    'IP Services / Cable (Ignite) / 1000.0Mb x 50.0Mb / 1 Dynamic IP',
  GIGA_PROFILE: 'Rogers Ignite - 1000.0 / 50.0Mbps - Dynamic IP',
  ROGERS_POST_URL: 'https://mam.salestreamsoft.com/api/rest/v2/rfqeasyquote',
  ROGERS_GET_URL: 'https://mam.salestreamsoft.com/api/rest/v2/powerquotes/',
});

export default URL;
