import url from '../../utils/enums/UrlEnum';

describe('Utility Enum test', () => {
  test('Should match the URL implemented in sending emails to partners', () => {
    expect(url.TELUS_EXCHANGE).toMatch('telusorders@telus.com');
    expect(url.EMAIL_SUBJECT).toMatch('Check Service Qualification');
    expect(url.EMAIL_TEXT).toMatch(
      'Hello, Would it be possible to kindly prequalify the addresses listed in the attached document?'
    );
  });
});
