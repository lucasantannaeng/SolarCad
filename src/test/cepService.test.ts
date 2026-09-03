import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCepData } from '../services/cepService';

describe('cepService — Consulta Rápida de CEP (BrasilAPI + ViaCEP)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null para CEPs inválidos ou com tamanho incorreto', async () => {
    expect(await fetchCepData('')).toBeNull();
    expect(await fetchCepData('123')).toBeNull();
    expect(await fetchCepData('1234567890')).toBeNull();
  });

  it('localiza endereço com sucesso via BrasilAPI', async () => {
    const mockBrasilApi = {
      cep: '22021001',
      state: 'RJ',
      city: 'Rio de Janeiro',
      neighborhood: 'Copacabana',
      street: 'Avenida Atlântica',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockBrasilApi,
    } as any);

    const result = await fetchCepData('22021-001');
    expect(result).toBeDefined();
    expect(result?.street).toBe('Avenida Atlântica');
    expect(result?.neighborhood).toBe('Copacabana');
    expect(result?.city).toBe('Rio de Janeiro');
    expect(result?.state).toBe('RJ');
    expect(result?.zipCode).toBe('22021-001');
  });

  it('executa fallback transparente para ViaCEP quando BrasilAPI falhar', async () => {
    // 1ª chamada (BrasilAPI) falha
    // 2ª chamada (ViaCEP) tem sucesso
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error BrasilAPI'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cep: '28625-000',
          logradouro: 'Praça Central',
          complemento: 'Lado Par',
          bairro: 'Centro',
          localidade: 'Nova Friburgo',
          uf: 'RJ',
        }),
      } as any);

    const result = await fetchCepData('28625000');
    expect(result).toBeDefined();
    expect(result?.street).toBe('Praça Central');
    expect(result?.neighborhood).toBe('Centro');
    expect(result?.city).toBe('Nova Friburgo');
    expect(result?.state).toBe('RJ');
    expect(result?.zipCode).toBe('28625-000');
    expect(result?.complement).toBe('Lado Par');
  });

  it('retorna null se ambas as APIs falharem', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('BrasilAPI offline'))
      .mockRejectedValueOnce(new Error('ViaCEP offline'));

    const result = await fetchCepData('99999999');
    expect(result).toBeNull();
  });
});
