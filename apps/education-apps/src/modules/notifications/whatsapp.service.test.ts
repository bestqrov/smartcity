import prisma from '../../config/database';
import * as evolution from './evolution.client';
import { connect } from './whatsapp.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { whatsappChannel: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() } },
}));
jest.mock('./evolution.client', () => ({
    isEvolutionConfigured: jest.fn(() => true),
    instanceName: (b: string) => `arwa-${b}`,
    connectionState: jest.fn(),
    connectInstance: jest.fn(),
    createInstance: jest.fn(),
    fetchOwnerPhone: jest.fn(),
}));

const m = (fn: unknown) => fn as jest.Mock;
const httpError = (status: number) => Object.assign(new Error(`Evolution API ${status}`), { status });

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.whatsappChannel.upsert).mockResolvedValue({ branchId: 'b1', instance: 'arwa-b1', phone: '2126111' });
    m(prisma.whatsappChannel.update).mockImplementation(async (a: any) => ({ branchId: 'b1', ...a.data }));
});

describe('whatsapp connect', () => {
    it('already open → CONNECTED with refreshed phone, no QR', async () => {
        m(evolution.connectionState).mockResolvedValue('open');
        m(evolution.fetchOwnerPhone).mockResolvedValue('2126999');
        const res = await connect('b1');
        expect(prisma.whatsappChannel.update).toHaveBeenCalledWith({ where: { branchId: 'b1' }, data: { status: 'CONNECTED', phone: '2126999' } });
        expect(res).toMatchObject({ status: 'CONNECTED', phone: '2126999', qr: { base64: null, code: null } });
        expect(evolution.connectInstance).not.toHaveBeenCalled();
    });

    it('instance missing (404) → createInstance', async () => {
        m(evolution.connectionState).mockRejectedValue(httpError(404));
        m(evolution.connectInstance).mockRejectedValue(httpError(404));
        m(evolution.createInstance).mockResolvedValue({ base64: 'img' });
        const res = await connect('b1');
        expect(evolution.createInstance).toHaveBeenCalledWith('arwa-b1');
        expect(res).toMatchObject({ status: 'CONNECTING', qr: { base64: 'img', code: null } });
    });

    it('other connect errors propagate without creating', async () => {
        m(evolution.connectionState).mockResolvedValue('close');
        m(evolution.connectInstance).mockRejectedValue(httpError(500));
        await expect(connect('b1')).rejects.toThrow('Evolution API 500');
        expect(evolution.createInstance).not.toHaveBeenCalled();
    });
});
