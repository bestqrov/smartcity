import { Response } from 'express';
import { respond } from './http';

const makeRes = () => {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res as Response;
};

const opts = { message: 'ok', failure: 'failed' };

describe('respond', () => {
    afterEach(() => jest.restoreAllMocks());

    it('sends success with default status 200', async () => {
        const res = makeRes();
        await respond(res, async () => ({ a: 1 }), opts);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { a: 1 }, message: 'ok' });
    });

    it('sends success with a custom status', async () => {
        const res = makeRes();
        await respond(res, async () => 'x', { ...opts, status: 201 });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('maps "... not found" to 404', async () => {
        const res = makeRes();
        await respond(res, async () => { throw new Error('Route Not Found'); }, opts);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Route Not Found', message: 'failed' });
    });

    it('maps a plain Error to 400 with its message', async () => {
        const res = makeRes();
        await respond(res, async () => { throw new Error('bad input'); }, opts);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'bad input', message: 'failed' });
    });

    it('handles a thrown string without crashing', async () => {
        const res = makeRes();
        await respond(res, async () => { throw 'boom'; }, opts);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'boom', message: 'failed' });
    });

    it('handles a thrown undefined without crashing', async () => {
        const res = makeRes();
        await respond(res, async () => { throw undefined; }, opts);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'undefined', message: 'failed' });
    });

    it('maps PrismaClient errors to 500 with a generic message and logs the original', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const res = makeRes();
        const err = new Error('connection string leaked: postgres://secret');
        err.name = 'PrismaClientKnownRequestError';
        await respond(res, async () => { throw err; }, opts);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal server error', message: 'failed' });
        expect(spy).toHaveBeenCalled();
    });
});
