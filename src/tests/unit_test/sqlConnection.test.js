import * as dbServer from '../../dbServer';

test('Ping database connection', async () => {
  const connection = await dbServer.getConnection();
  expect(connection.state).toBe('authenticated');
  connection.end();
});
