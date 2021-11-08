const express = require('express');

const app = express();

const supertest = require('supertest');

const request = supertest(app);

app.post(
  '/localhost:8080/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification',
  async (req, res) => {
    res.json({ message: 'pass!' });
  }
);

it('post the test endpoint', async () => {
  const response = await request.post(
    '/localhost:8080/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification'
  );

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('pass!');
});
