module.exports = {
    //connection: 'postgresql://192.168.0.177:Qmdldpadptm!123@localhost/myapp_test',
    HOST: "10.5.0.2",
    USER: "cvmsskb",
    PASSWORD: "Qmdldpadptm!123",
    DB: "cvms4",
    PORT: 5432,
    DB_SSL: false,
    dialect: "postgres",
    POOL : { min: 0, max: 20/*,acquire: 30000,
        idle: 10000 */
    }

};