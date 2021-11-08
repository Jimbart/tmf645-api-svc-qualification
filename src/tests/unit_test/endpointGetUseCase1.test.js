import express from 'express';
import supertest from 'supertest';

const app = express();
const request = supertest(app);

app.get(
  '/localhost:8080/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification/1KPfXU40HGylSxgWk2KE',
  async (req, res) => {
    res.json({ message: 'pass!' });
  }
);

it('gets the test endpoint', async () => {
  const response = await request.get(
    '/localhost:8080/placeholder/off-net/serviceQualificationManagement/v4/queryServiceQualification/1KPfXU40HGylSxgWk2KE'
  );
  expect(response.status).toBe(200);
  expect(response.body.message).toBe('pass!');
});
