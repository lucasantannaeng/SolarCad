import React, { useRef, useState } from 'react';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel, ModuleData, InverterData, EquipmentBlock, CreditBeneficiary, GDType } from '@/types';
import { UTILITIES, CONNECTION_TYPES, VOLTAGES, STANDARD_BREAKERS, DEFAULT_MODULE, DEFAULT_INVERTER } from '@/constants';
import { getProjectEngineeringStatus } from '@/services/engineering';
import { ocrEnergyBill, generateJustification, OcrResult } from '@/services/aiService';
import { validateCreditDistribution, distributeCreditsEqually, estimateMonthlyGeneration } from '@/services/creditDistribution';
import { downloadEnelRateioPDF, downloadEnelRateioExcel } from '@/services/enelFormService';
import { downloadCreditMatrixPDF, downloadCreditMatrixExcel } from '@/services/creditMatrixService';
import { validateProjectPreFlight } from '@/services/preFlightValidator';
import { downloadEnelAccessFormPDF } from '@/services/enelAccessFormService';
import { downloadLightFormPDF } from '@/services/lightFormService';
import { downloadCerciFormPDF } from '@/services/cerciFormService';
import { downloadEnergisaFormPDF } from '@/services/energisaFormService';
import { downloadPowerOfAttorneyPDF } from '@/services/powerOfAttorneyService';
import { useCompanyProfile, formatCEP, formatPhone, formatCPF, formatCNPJ } from '@/hooks/useCompanyProfile';
import { fetchCepData } from '@/services/cepService';
import { EquipmentBlockForm } from './EquipmentBlockForm';
import { ArtGuideModal } from './ArtGuideModal';
import { PreFlightAuditModal } from './PreFlightAuditModal';
import { AlertTriangle, CheckCircle, FileText, Zap, Plus, ScanLine, Loader2, Sparkles, Share2, Trash2, Users, Percent, FileSpreadsheet, Building2, Download, Award, ShieldCheck, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoTrigger } from '@/components/InfoTrigger';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  data: ProjectState;
  onChange: (data: ProjectState) => void;
  onGenerate: () => void;
  modules: ModuleData[];
  inverters: InverterData[];
}

const inputClass = "mt-1 block w-full rounded-md border border-input bg-card text-card-foreground shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 p-2 text-sm";
const selectClass = inputClass;
const labelClass = "block text-sm font-medium text-muted-foreground";

export const ProjectForm: React.FC<Props> = ({ data, onChange, onGenerate, modules, inverters }) => {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [justificationLoading, setJustificationLoading] = useState(false);
  const [justification, setJustification] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [artGuideOpen, setArtGuideOpen] = useState(false);
  const [preFlightOpen, setPreFlightOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateClient = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, [field]: value } });
  };

  const updateAddress = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, address: { ...data.client.address, [field]: value } } });
  };

  const handleCepSearch = async (cepOverride?: string) => {
    const rawCep = cepOverride !== undefined ? cepOverride : (data.client.address.zipCode || '');
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length !== 8) {
      toast.warning('Digite um CEP válido com 8 dígitos para consultar.');
      return;
    }

    setCepLoading(true);
    try {
      const result = await fetchCepData(clean);
      if (result) {
        onChange({
          ...data,
          client: {
            ...data.client,
            address: {
              ...data.client.address,
              zipCode: result.zipCode,
              street: result.street || data.client.address.street,
              neighborhood: result.neighborhood || data.client.address.neighborhood,
              city: result.city || data.client.address.city,
              state: result.state || data.client.address.state || 'RJ',
              complement: result.complement || data.client.address.complement || '',
            },
          },
        });
        toast.success(`Endereço localizado: ${result.street ? result.street + ', ' : ''}${result.neighborhood ? result.neighborhood + ' - ' : ''}${result.city}/${result.state}`);
      } else {
        toast.error('CEP não localizado nas bases nacionais (BrasilAPI / ViaCEP). Preencha manualmente.');
      }
    } catch (err: any) {
      toast.error(`Falha ao consultar CEP: ${err.message || 'Erro de conexão'}`);
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    updateAddress('zipCode', formatted);
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8 && !cepLoading) {
      handleCepSearch(formatted);
    }
  };

  const updateTechnical = (field: string, value: any) => {
    onChange({ ...data, technical: { ...data.technical, [field]: value } });
  };

  const updateBlock = (index: number, block: EquipmentBlock) => {
    const newBlocks = [...data.equipmentBlocks];
    newBlocks[index] = block;
    onChange({ ...data, equipmentBlocks: newBlocks });
  };

  const addBlock = () => {
    const newId = data.equipmentBlocks.length > 0
      ? Math.max(...data.equipmentBlocks.map(b => b.id)) + 1
      : 1;
    const defaultMod = modules[0] || DEFAULT_MODULE;
    const defaultInv = inverters[0] || DEFAULT_INVERTER;
    const newBlock: EquipmentBlock = {
      id: newId, moduleId: defaultMod.id, inverterId: defaultInv.id,
      module: defaultMod, inverter: defaultInv,
      inverterBrand: defaultInv.brand, inverterModel: defaultInv.model, inverterPowerKw: defaultInv.power,
      moduleBrand: defaultMod.brand, moduleModel: defaultMod.model, modulePowerW: defaultMod.power,
      moduleQty: 0, inverterQty: 1, strings: [{ id: 1, count: 0 }],
      structureType: 'CERAMIC',
      roofPlaneName: `Água ${newId} (Norte - Telhado Principal)`,
      azimuth: 0,
      tilt: 15,
    };
    onChange({ ...data, equipmentBlocks: [...data.equipmentBlocks, newBlock] });
  };

  const removeBlock = (index: number) => {
    onChange({ ...data, equipmentBlocks: data.equipmentBlocks.filter((_, i) => i !== index) });
  };

  const beneficiaries = data.creditBeneficiaries || [];

  const updateBeneficiary = (index: number, field: keyof CreditBeneficiary, value: any) => {
    const next = [...beneficiaries];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, creditBeneficiaries: next });
  };

  const addBeneficiary = (isGen = false) => {
    const newId = String(Date.now());
    const next = [
      ...beneficiaries,
      {
        id: newId,
        utilityId: isGen ? (data.client.utilityId || '') : '',
        document: isGen ? (data.client.document || '') : '',
        description: isGen ? 'UC Geradora (Local)' : `UC Beneficiária ${beneficiaries.length + 1}`,
        percentage: 0,
        isGenerator: isGen,
        averageConsumptionKwh: 0,
      },
    ];
    onChange({ ...data, creditBeneficiaries: next });
  };

  const removeBeneficiary = (index: number) => {
    const next = beneficiaries.filter((_, i) => i !== index);
    onChange({ ...data, creditBeneficiaries: next });
  };

  const handleDistributeEqually = () => {
    if (!beneficiaries.length) return;
    const distributed = distributeCreditsEqually(beneficiaries);
    onChange({ ...data, creditBeneficiaries: distributed });
    toast.success('Créditos distribuídos igualmente entre as UCs!');
  };

  const getUtilityShortLabel = (utility: UtilityCompany): string => {
    switch (utility) {
      case UtilityCompany.LIGHT:
        return 'Light';
      case UtilityCompany.ENEL_RJ:
        return 'Enel RJ';
      case UtilityCompany.CERCI:
        return 'CERCI';
      case UtilityCompany.ENERGISA:
        return 'Energisa';
      default:
        return 'Concessionária';
    }
  };

  const handleGenerateUtilityAccessForm = () => {
    try {
      switch (data.technical.utility) {
        case UtilityCompany.LIGHT:
          downloadLightFormPDF(data);
          toast.success('Formulário de Solicitação de Acesso da Light (RECON-BT) gerado com sucesso!');
          break;
        case UtilityCompany.CERCI:
          downloadCerciFormPDF(data);
          toast.success('Formulário de Solicitação de Acesso da CERCI gerado com sucesso!');
          break;
        case UtilityCompany.ENERGISA:
          downloadEnergisaFormPDF(data);
          toast.success('Formulário de Solicitação de Acesso da Energisa (NDU-013) gerado com sucesso!');
          break;
        case UtilityCompany.ENEL_RJ:
        default:
          downloadEnelAccessFormPDF(data);
          toast.success('Formulário de Solicitação de Acesso da Enel RJ (CNC-GD) gerado com sucesso!');
          break;
      }
    } catch (err: any) {
      console.error('Erro ao gerar formulário da concessionária:', err);
      toast.error(`Erro ao gerar formulário: ${err.message}`);
    }
  };

  const handleExportEnelRateio = () => {
    try {
      const fileName = downloadEnelRateioPDF(data);
      toast.success(`Formulário de Rateio Enel RJ (PDF) gerado com sucesso: ${fileName}`);
    } catch (err: any) {
      console.error('Enel PDF error:', err);
      toast.error(`Erro ao gerar formulário de rateio Enel: ${err.message}`);
    }
  };

  const handleExportEnelRateioExcel = async () => {
    try {
      const fileName = await downloadEnelRateioExcel(data);
      toast.success(`Planilha oficial de Rateio Enel RJ (.xlsm) gerada com sucesso: ${fileName}`);
    } catch (err: any) {
      console.error('Enel Excel error:', err);
      toast.error(`Erro ao gerar planilha de rateio Enel: ${err.message}`);
    }
  };

  const handleExportCreditMatrix = () => {
    try {
      const fileName = downloadCreditMatrixPDF(data);
      toast.success(`Matriz de Rateio (${getUtilityShortLabel(data.technical.utility)}) gerada em PDF: ${fileName}`);
    } catch (err: any) {
      console.error('Matrix PDF error:', err);
      toast.error(`Erro ao gerar matriz de rateio: ${err.message}`);
    }
  };

  const handleExportCreditMatrixExcel = async () => {
    try {
      const fileName = await downloadCreditMatrixExcel(data);
      toast.success(`Planilha de Rateio (${getUtilityShortLabel(data.technical.utility)}) gerada em Excel: ${fileName}`);
    } catch (err: any) {
      console.error('Matrix Excel error:', err);
      toast.error(`Erro ao gerar planilha de rateio: ${err.message}`);
    }
  };

  const { profile: savedCompanyProfile } = useCompanyProfile();

  const handleGeneratePowerOfAttorney = () => {
    try {
      const currentCompany = data.companyProfile || savedCompanyProfile;
      if (!data.client.name) {
        toast.warning('Informe o Nome do Cliente (Outorgante) antes de gerar a procuração.');
        return;
      }
      downloadPowerOfAttorneyPDF(data, currentCompany);
      toast.success('Procuração GD Oficial gerada com sucesso (pronta para assinatura digital Gov.br/Clicksign)!');
    } catch (err: any) {
      console.error('Erro ao gerar procuração:', err);
      toast.error(`Erro ao gerar procuração: ${err.message}`);
    }
  };

  const handleLoadCompanyProfile = () => {
    if (!savedCompanyProfile?.companyName && !savedCompanyProfile?.legalRepresentative?.name) {
      toast.warning('Nenhum perfil de empresa cadastrado ainda. Use a opção "Empresa & Procurador" na barra lateral.');
      return;
    }

    const rep = savedCompanyProfile.legalRepresentative;
    onChange({
      ...data,
      companyProfile: savedCompanyProfile,
      engineer: {
        name: rep.name || data.engineer?.name || '',
        crea: rep.creaCft ? `${rep.creaCft}/${rep.creaState}` : data.engineer?.crea || '',
      },
    });
    toast.success('Dados da Empresa Integradora e Responsável Técnico carregados no projeto!');
  };

  // === OCR ===
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setOcrLoading(true);
    try {
      const result: OcrResult = await ocrEnergyBill(file);

      // Inferir tipo de ligação a partir do supplyType, sem sobrescrever escolha manual
      const inferredConnection = (() => {
        const s = (result.supplyType || '').toLowerCase();
        if (s.includes('mono')) return ConnectionType.MONOPHASIC;
        if (s.includes('bi')) return ConnectionType.BIPHASIC;
        if (s.includes('tri')) return ConnectionType.TRIPHASIC;
        return undefined;
      })();

      const inferredVoltage = (() => {
        const v = (result.supplyVoltage || '').replace(/\s/g, '');
        if (v.includes('127') || v.includes('127/220')) return VoltageLevel.V_127_220;
        if (v.includes('220/380') || v.includes('380')) return VoltageLevel.V_220_380;
        return undefined;
      })();

      const utilityChanged = result.utility === 'ENEL_RJ'
        ? UtilityCompany.ENEL_RJ
        : result.utility === 'LIGHT'
          ? UtilityCompany.LIGHT
          : result.utility === 'CERCI'
            ? UtilityCompany.CERCI
            : result.utility === 'ENERGISA'
              ? UtilityCompany.ENERGISA
              : data.technical.utility;

      onChange({
        ...data,
        client: {
          ...data.client,
          name: result.clientName || data.client.name,
          utilityId: result.utilityId || data.client.utilityId,
          address: {
            street: result.address?.street || data.client.address.street,
            number: result.address?.number || data.client.address.number,
            neighborhood: result.address?.neighborhood || data.client.address.neighborhood,
            city: result.address?.city || data.client.address.city,
            state: result.address?.state || data.client.address.state,
            zipCode: result.address?.zipCode || data.client.address.zipCode,
          },
        },
        technical: {
          ...data.technical,
          utility: utilityChanged,
          connectionType: inferredConnection ?? data.technical.connectionType,
          voltage: inferredVoltage ?? data.technical.voltage,
        },
      });

      const extras: string[] = [];
      if (result.subgroup) extras.push(`Subgrupo ${result.subgroup}`);
      if (result.tariffModality) extras.push(result.tariffModality);
      if (result.averageConsumptionKwh) extras.push(`Média ${result.averageConsumptionKwh} kWh`);
      toast.success(
        `Dados extraídos com sucesso!${extras.length ? ' ' + extras.join(' · ') : ''} Confira os campos.`
      );
    } catch (err: any) {
      toast.error(`Erro no OCR: ${err.message}`);
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // === Justification ===
  const handleGenerateJustification = async () => {
    setJustificationLoading(true);
    try {
      const engResult = getProjectEngineeringStatus(data.equipmentBlocks, data.technical);
      const addr = data.client.address;
      const result = await generateJustification({
        clientName: data.client.name,
        address: `${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city}/${addr.state}`,
        utility: data.technical.utility,
        connectionType: data.technical.connectionType,
        voltage: data.technical.voltage,
        mainBreaker: data.technical.mainBreaker,
        distance: data.technical.distance,
        equipmentBlocks: data.equipmentBlocks,
        totalDcPower: engResult.totalDcPower,
        totalAcPower: engResult.totalAcPower,
      });
      setJustification(result.justification);
      toast.success('Justificativa técnica gerada!');
    } catch (err: any) {
      toast.error(`Erro ao gerar justificativa: ${err.message}`);
    } finally {
      setJustificationLoading(false);
    }
  };

  const engResult = getProjectEngineeringStatus(data.equipmentBlocks, data.technical);
  const estMonthlyGen = estimateMonthlyGeneration(engResult.totalDcPower);
  const creditValidation = validateCreditDistribution(beneficiaries, estMonthlyGen);

  return (
    <div className="space-y-6">
      {/* OCR Section */}
      <section className="bg-gradient-to-r from-brand-900/10 to-accent/10 p-6 rounded-lg shadow-sm border border-brand-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-brand-500" />
              Leitura Inteligente
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">Faça upload da conta de energia para preencher automaticamente os dados do cliente. <InfoTrigger helpKey="ocr" /></p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleOcrUpload} />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
            >
              {ocrLoading ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <><ScanLine size={16} /> Escanear Conta de Energia</>}
            </Button>
          </div>
        </div>
      </section>

      {/* Utility */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-500" />
            Concessionária e Padrão
            <InfoTrigger helpKey="concessionaria" />
          </h2>
          <div className="flex items-center flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleGeneratePowerOfAttorney}
              variant="outline"
              className="border-accent/50 hover:bg-accent/10 text-accent-foreground font-semibold gap-1.5 shadow-sm text-xs md:text-sm"
              title="Gera a Procuração Específica de Homologação GD em PDF pronta para assinatura digital do cliente (Gov.br / Clicksign)"
            >
              <FileText className="w-4 h-4 text-accent" />
              📄 Gerar Procuração GD
            </Button>
            <Button
              type="button"
              onClick={handleGenerateUtilityAccessForm}
              variant="outline"
              className="border-brand-500/40 hover:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold gap-2 shadow-sm text-xs md:text-sm"
              title={`Gera o formulário oficial de solicitação de acesso para ${getUtilityShortLabel(data.technical.utility)}`}
            >
              <FileSpreadsheet className="w-4 h-4 text-brand-500" />
              📄 Gerar Formulário de Acesso ({getUtilityShortLabel(data.technical.utility)})
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Concessionária <InfoTrigger helpKey="concessionaria" size={12} /></label>
            <select className={selectClass} value={data.technical.utility} onChange={e => updateTechnical('utility', e.target.value)}>
              {UTILITIES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Identificação ({data.technical.utility === UtilityCompany.LIGHT ? 'Cód. Cliente' : data.technical.utility === UtilityCompany.CERCI ? 'Matrícula Cooperado (UC)' : data.technical.utility === UtilityCompany.ENERGISA ? 'Nº CDC / UC' : 'Nº UC'})
            </label>
            <input type="text" className={inputClass} value={data.client.utilityId} onChange={e => updateClient('utilityId', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Client */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-500" />
          Dados do Cliente / Titular da UC
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className={labelClass}>Nome Completo / Razão Social</label>
            <input
              type="text"
              placeholder="Ex: Maria Antônia Pereira ou Empresa Ltda"
              className={inputClass}
              value={data.client.name}
              onChange={e => updateClient('name', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>CPF / CNPJ</label>
            <input
              type="text"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className={inputClass}
              value={data.client.document}
              onChange={e => {
                const raw = e.target.value;
                const clean = raw.replace(/\D/g, '');
                const formatted = clean.length > 11 ? formatCNPJ(raw) : (clean.length > 0 ? formatCPF(raw) : raw);
                updateClient('document', formatted);
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="cliente@email.com"
              className={inputClass}
              value={data.client.email}
              onChange={e => updateClient('email', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Telefone / WhatsApp</label>
            <input
              type="text"
              placeholder="(21) 99999-8888"
              className={inputClass}
              value={data.client.phone || ''}
              onChange={e => updateClient('phone', formatPhone(e.target.value))}
            />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>Nº ART / TRT <InfoTrigger helpKey="art" size={12} /></label>
            <input
              type="text"
              placeholder="Ex: ART-2026-123456 ou TRT-2026-789012"
              className={inputClass}
              value={data.client.art || ''}
              onChange={e => updateClient('art', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Installation Address / Site Location */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-500" />
              Endereço da Instalação / Local da Obra
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Endereço físico onde a usina fotovoltaica será instalada e vistoriada pela equipe técnica da distribuidora.
            </p>
          </div>
        </div>

        {/* Card/Banner Normativo de Alerta */}
        {(() => {
          const street = data.client.address?.street?.trim() || '';
          const num = data.client.address?.number?.trim() || '';
          const neigh = data.client.address?.neighborhood?.trim() || '';
          const cit = data.client.address?.city?.trim() || '';
          const zip = data.client.address?.zipCode?.trim() || '';
          const comp = data.client.address?.complement?.trim() || '';
          const isAddrComplete = Boolean(street && num && neigh && cit && zip);

          const missing: string[] = [];
          if (!zip) missing.push('CEP');
          if (!street) missing.push('Logradouro');
          if (!num) missing.push('Número');
          if (!neigh) missing.push('Bairro');
          if (!cit) missing.push('Cidade');

          if (!isAddrComplete) {
            return (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Normas de Atendimento das Distribuidoras (Enel RJ CNC-GD, Light RECON-BT, Energisa NDU-013, CERCI)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Aviso Normativo
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    ⚠️ Endereço incompleto. Concessionárias exigem Logradouro, Número, Bairro, Cidade e CEP para abrir a ordem de serviço de vistoria.
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    <span className="font-medium text-foreground">Ação Recomendada:</span> Complete o endereço da obra com CEP e Cidade antes do protocolo.
                  </p>
                  {missing.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground font-medium">Campos pendentes:</span>
                      {missing.map((field) => (
                        <span key={field} className="px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-bold">
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Normas de Atendimento das Distribuidoras (Enel RJ CNC-GD, Light RECON-BT, Energisa NDU-013, CERCI)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  ✓ Endereço Conforme com Normas das Concessionárias
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Endereço validado: {street}, {num}{comp ? ` (${comp})` : ''} - {neigh}, {cit}/{data.client.address?.state || 'RJ'} - CEP: {zip}.
              </p>
            </div>
          );
        })()}

        {/* Address Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* CEP com Busca Automática */}
          <div className="md:col-span-2">
            <label className={labelClass}>CEP</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder="00000-000"
                className="block w-full rounded-md border border-input bg-card text-card-foreground shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 p-2 text-sm font-mono"
                value={data.client.address?.zipCode || ''}
                onChange={handleCepChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCepSearch();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCepSearch()}
                disabled={cepLoading}
                className="shrink-0 text-xs gap-1 border-brand-500/50 hover:bg-brand-500/10 text-brand-600 dark:text-brand-300"
                title="Buscar dados do endereço via CEP"
              >
                {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Buscar CEP
              </Button>
            </div>
          </div>

          {/* Logradouro */}
          <div className="md:col-span-4">
            <label className={labelClass}>Logradouro (Rua, Av, Rodovia, Estrada)</label>
            <input
              type="text"
              placeholder="Ex: Av. Atlântica ou Rua Principal"
              className={inputClass}
              value={data.client.address?.street || ''}
              onChange={e => updateAddress('street', e.target.value)}
            />
          </div>

          {/* Número */}
          <div className="md:col-span-2">
            <label className={labelClass}>Número</label>
            <input
              type="text"
              placeholder="Ex: 1500 ou S/N"
              className={inputClass}
              value={data.client.address?.number || ''}
              onChange={e => updateAddress('number', e.target.value)}
            />
          </div>

          {/* Complemento */}
          <div className="md:col-span-4">
            <label className={labelClass}>Complemento (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Apto 101, Bloco 2, Galpão 3, Casa A, Lote 14"
              className={inputClass}
              value={data.client.address?.complement || ''}
              onChange={e => updateAddress('complement', e.target.value)}
            />
          </div>

          {/* Bairro */}
          <div className="md:col-span-2">
            <label className={labelClass}>Bairro</label>
            <input
              type="text"
              placeholder="Ex: Copacabana"
              className={inputClass}
              value={data.client.address?.neighborhood || ''}
              onChange={e => updateAddress('neighborhood', e.target.value)}
            />
          </div>

          {/* Cidade */}
          <div className="md:col-span-3">
            <label className={labelClass}>Cidade</label>
            <input
              type="text"
              placeholder="Ex: Rio de Janeiro"
              className={inputClass}
              value={data.client.address?.city || ''}
              onChange={e => updateAddress('city', e.target.value)}
            />
          </div>

          {/* Estado / UF */}
          <div className="md:col-span-1">
            <label className={labelClass}>Estado (UF)</label>
            <input
              type="text"
              maxLength={2}
              placeholder="RJ"
              className={`${inputClass} uppercase text-center font-mono font-bold`}
              value={data.client.address?.state || 'RJ'}
              onChange={e => updateAddress('state', e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </section>

      {/* Engineer */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Responsável Técnico & Empresa Integradora</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleLoadCompanyProfile}
            className="text-xs border-brand-500/40 text-brand-600 dark:text-brand-300 hover:bg-brand-500/10 gap-1.5"
            title="Preenche os dados do engenheiro e empresa a partir do perfil salvo"
          >
            <Building2 className="w-3.5 h-3.5 text-brand-500" />
            🏢 Preencher Dados da Empresa / RT
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Engenheiro / RT</label>
            <input type="text" className={inputClass} value={data.engineer?.name || ''} onChange={e => onChange({ ...data, engineer: { ...data.engineer, name: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>Nº CREA / CFT</label>
            <input type="text" className={inputClass} value={data.engineer?.crea || ''} onChange={e => onChange({ ...data, engineer: { ...data.engineer, crea: e.target.value } })} />
          </div>
        </div>
      </section>

      {/* Technical */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Dados Técnicos da Instalação</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className={labelClass}>Tipo Conexão <InfoTrigger helpKey="connectionType" size={12} /></label>
            <select className={selectClass} value={data.technical.connectionType} onChange={e => updateTechnical('connectionType', e.target.value)}>
              {CONNECTION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tensão Rede <InfoTrigger helpKey="voltage" size={12} /></label>
            <select className={selectClass} value={data.technical.voltage} onChange={e => updateTechnical('voltage', e.target.value)}>
              {VOLTAGES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Disjuntor Padrão (A) <InfoTrigger helpKey="mainBreaker" size={12} /></label>
            <select className={selectClass} value={data.technical.mainBreaker} onChange={e => updateTechnical('mainBreaker', Number(e.target.value))}>
              {STANDARD_BREAKERS.map(b => <option key={b} value={b}>{b} A</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Distância Padrão (m) <InfoTrigger helpKey="distance" size={12} /></label>
            <input type="number" min="1" className={inputClass} value={data.technical.distance} onChange={e => updateTechnical('distance', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Dist. Módulos→Inversor (m)</label>
            <input type="number" min="1" className={inputClass} value={data.technical.dcCableDistance || 15} onChange={e => updateTechnical('dcCableDistance', Number(e.target.value) || 15)} placeholder="15" />
          </div>
        </div>
      </section>

      {/* Equipment Blocks */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Equipamentos e Strings
            <span className={`text-sm px-3 py-1 rounded-full border ${
              engResult.overallStatus === 'SUCCESS' ? 'bg-success/10 text-success border-success/20' :
              engResult.overallStatus === 'WARNING' ? 'bg-warning/10 text-warning border-warning/20' :
              'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {engResult.overallStatus === 'SUCCESS' ? 'Aprovado' :
               engResult.overallStatus === 'WARNING' ? 'Atenção' : 'Erro'}
            </span>
          </h2>
          <button onClick={addBlock} className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-brand-600 text-primary-foreground rounded-md hover:bg-brand-700 transition">
            <Plus size={16} /> Adicionar Conjunto
          </button>
        </div>

        <div className="space-y-4">
          {data.equipmentBlocks.map((block, idx) => (
            <EquipmentBlockForm
              key={block.id}
              block={block}
              blockIndex={idx}
              totalBlocks={data.equipmentBlocks.length}
              engineeringResult={engResult.blocks[idx]}
              modules={modules}
              inverters={inverters}
              onChange={(updated) => updateBlock(idx, updated)}
              onRemove={() => removeBlock(idx)}
            />
          ))}
        </div>

        {/* Global Engineering Summary */}
        <div className={`mt-6 p-4 rounded border ${engResult.overallStatus === 'ERROR' ? 'bg-destructive/5 border-destructive/20' : 'bg-secondary border-border'}`}>
          <h4 className="font-bold text-foreground mb-2">Resumo de Engenharia (Todos os Conjuntos)</h4>
          {engResult.globalWarnings.length > 0 && (
            <div className="space-y-2 mb-3">
              {engResult.globalWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {engResult.globalWarnings.length === 0 && engResult.overallStatus === 'SUCCESS' && (
            <div className="flex items-center gap-2 text-success text-sm mb-3">
              <CheckCircle size={16} /> Sistema perfeitamente dimensionado.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3 border-t border-border">
            <div>
              <span className="block text-muted-foreground">Corrente Total</span>
              <span className="font-mono font-bold">{engResult.totalNominalCurrent.toFixed(1)} A</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Proteção Geral</span>
              <span className="font-mono font-bold text-brand-600">{engResult.totalSuggestedBreaker}A {engResult.totalBreakerPolarity}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Potência DC Total</span>
              <span className="font-mono font-bold">{engResult.totalDcPower.toFixed(2)} kWp</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Potência AC Total</span>
              <span className="font-mono font-bold">{engResult.totalAcPower.toFixed(2)} kW</span>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Distribution (Lei 14.300 / ANEEL) */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Share2 className="w-5 h-5 text-brand-500" />
              Rateio de Créditos e GD Compartilhada (Lei 14.300)
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure o enquadramento de GD e a distribuição de excedentes entre a UC Geradora e as UCBs participantes.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data.technical.utility === UtilityCompany.ENEL_RJ ? (
              <>
                <Button
                  onClick={handleExportEnelRateio}
                  variant="outline"
                  size="sm"
                  className="bg-brand-50 hover:bg-brand-100 text-brand-800 border-brand-300 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800 text-xs font-bold gap-1.5 shadow-sm"
                  title="Gera o formulário oficial de rateio da Enel RJ em PDF conforme a Lei 14.300"
                >
                  <FileSpreadsheet size={15} className="text-brand-600 dark:text-brand-400" />
                  Formulário ENEL RJ (PDF)
                </Button>
                <Button
                  onClick={handleExportEnelRateioExcel}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold gap-1.5 shadow-sm"
                  title="Preenche e exporta a planilha Excel oficial da Enel RJ (.xlsm)"
                >
                  <Download size={15} className="text-emerald-600 dark:text-emerald-400" />
                  Planilha ENEL RJ (.xlsm)
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleExportCreditMatrix}
                  variant="outline"
                  size="sm"
                  className="bg-brand-50 hover:bg-brand-100 text-brand-800 border-brand-300 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-800 text-xs font-bold gap-1.5 shadow-sm"
                  title={`Gera a Matriz de Rateio oficial (${getUtilityShortLabel(data.technical.utility)}) em PDF`}
                >
                  <FileSpreadsheet size={15} className="text-brand-600 dark:text-brand-400" />
                  Matriz {getUtilityShortLabel(data.technical.utility)} (PDF)
                </Button>
                <Button
                  onClick={handleExportCreditMatrixExcel}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold gap-1.5 shadow-sm"
                  title={`Gera a Planilha Excel de Rateio (${getUtilityShortLabel(data.technical.utility)})`}
                >
                  <Download size={15} className="text-emerald-600 dark:text-emerald-400" />
                  Planilha {getUtilityShortLabel(data.technical.utility)} (.xlsx)
                </Button>
              </>
            )}
            {beneficiaries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDistributeEqually}
                className="text-xs gap-1"
                title="Divide 100% igualmente entre as UCs cadastradas"
              >
                <Percent size={14} /> Distribuir Igualmente
              </Button>
            )}
            <Button
              onClick={() => addBeneficiary(false)}
              size="sm"
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground text-xs gap-1"
            >
              <Plus size={14} /> Adicionar UCB
            </Button>
          </div>
        </div>

        {/* Modalidade de GD & UC Provedora Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40 border border-border mb-4">
          <div>
            <label className={labelClass}>Modalidade de Geração Distribuída (Enquadramento)</label>
            <select
              className={selectClass}
              value={data.gdType || 'Autoconsumo remoto'}
              onChange={e => onChange({ ...data, gdType: e.target.value as GDType })}
            >
              <option value="Autoconsumo remoto">Autoconsumo remoto (mesmo titular / CPF/CNPJ)</option>
              <option value="Consumo Local">Consumo Local (100% no local de geração)</option>
              <option value="Geração Compartilhada">Geração Compartilhada (Consórcio / Cooperativa)</option>
              <option value="Empreendimento com Múltiplas Unidades">Empreendimento com Múltiplas Unidades (EMUC / Condomínio)</option>
            </select>
          </div>
          <div className="flex flex-col justify-between">
            <label className={labelClass}>UC Geradora / Provedora (UCP)</label>
            <div className="flex items-center justify-between p-2 rounded bg-card border border-input text-xs mt-1">
              <div>
                <span className="font-bold text-foreground">UC {data.client.utilityId || 'Não informada'}</span>
                <span className="text-muted-foreground ml-2 font-mono">({data.client.document || 'Sem CPF/CNPJ'})</span>
              </div>
              {!beneficiaries.some(b => b.isGenerator) && (
                <Button
                  onClick={() => addBeneficiary(true)}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950"
                >
                  + Incluir no Rateio
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar & Generation Estimate */}
        {beneficiaries.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Total Alocado:</span>
                <span className={`font-mono font-bold text-base ${
                  creditValidation.isComplete ? 'text-success' :
                  creditValidation.isValid ? 'text-warning' : 'text-destructive'
                }`}>
                  {creditValidation.totalPercentage.toFixed(1)}% / 100%
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  creditValidation.isComplete ? 'bg-success/10 text-success border-success/20' :
                  creditValidation.isValid ? 'bg-warning/10 text-warning border-warning/20' :
                  'bg-destructive/10 text-destructive border-destructive/20'
                }`}>
                  {creditValidation.isComplete ? '100% Alocado' :
                   creditValidation.isValid ? `Restam ${(100 - creditValidation.totalPercentage).toFixed(1)}%` : 'Excede 100%'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Geração Estimada da Usina: <span className="font-mono font-bold text-foreground">{estimateMonthlyGeneration(engResult.totalDcPower).toFixed(0)} kWh/mês</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  creditValidation.isComplete ? 'bg-success' :
                  creditValidation.isValid ? 'bg-brand-500' : 'bg-destructive'
                }`}
                style={{ width: `${Math.min(100, creditValidation.totalPercentage)}%` }}
              />
            </div>

            {creditValidation.warnings.length > 0 && (
              <div className="space-y-1 pt-1">
                {creditValidation.warnings.map((w, i) => (
                  <div key={i} className={`flex items-start gap-1 text-xs ${creditValidation.isValid ? 'text-warning' : 'text-destructive'}`}>
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Beneficiaries Table */}
        {beneficiaries.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma unidade beneficiária cadastrada. Toda a energia será alocada na UC Geradora Principal ({data.client.utilityId || 'UC Principal'}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="p-3">Nº da UC (Sem dígito)</th>
                  <th className="p-3">CPF / CNPJ</th>
                  <th className="p-3">Identificação / Titular</th>
                  <th className="p-3 text-right">Consumo (kWh)</th>
                  <th className="p-3 text-right">% Rateio</th>
                  <th className="p-3 text-right">Crédito Estimado</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {beneficiaries.map((b, idx) => {
                  const estKwh = (estimateMonthlyGeneration(engResult.totalDcPower) * (Number(b.percentage) || 0)) / 100;
                  return (
                    <tr key={b.id || idx} className={`hover:bg-secondary/30 transition-colors ${b.isGenerator ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}`}>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Ex: 12345678"
                            className="w-full p-1.5 text-sm rounded border border-input bg-card text-card-foreground font-mono"
                            value={b.utilityId}
                            onChange={e => updateBeneficiary(idx, 'utilityId', e.target.value)}
                          />
                          {b.isGenerator && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold whitespace-nowrap">
                              UCP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          className="w-full p-1.5 text-sm rounded border border-input bg-card text-card-foreground font-mono"
                          value={b.document || ''}
                          onChange={e => updateBeneficiary(idx, 'document', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Ex: Filial Centro / Apto 101"
                          className="w-full p-1.5 text-sm rounded border border-input bg-card text-card-foreground"
                          value={b.description}
                          onChange={e => updateBeneficiary(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-20 p-1.5 text-sm rounded border border-input bg-card text-card-foreground text-right font-mono"
                          value={b.averageConsumptionKwh || ''}
                          onChange={e => updateBeneficiary(idx, 'averageConsumptionKwh', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0"
                            className="w-20 p-1.5 text-sm rounded border border-input bg-card text-card-foreground text-right font-mono font-bold"
                            value={b.percentage || ''}
                            onChange={e => updateBeneficiary(idx, 'percentage', Number(e.target.value) || 0)}
                          />
                          <span className="text-muted-foreground font-mono">%</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono text-xs">
                        <span className="font-bold text-foreground">{estKwh.toFixed(0)} kWh</span>
                        {b.averageConsumptionKwh && b.averageConsumptionKwh > 0 ? (
                          <span className="block text-[11px] text-muted-foreground">
                            ({Math.min(100, Math.round((estKwh / b.averageConsumptionKwh) * 100))}% do consumo)
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeBeneficiary(idx)}
                          className="text-destructive hover:text-destructive/80 p-1.5 rounded transition"
                          title="Remover beneficiária"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI Justification */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" />
            Justificativa Técnica (IA)
            <InfoTrigger helpKey="justification" />
          </h2>
          <Button
            onClick={handleGenerateJustification}
            disabled={justificationLoading}
            className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
          >
            {justificationLoading ? <><Loader2 size={16} className="animate-spin" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
          </Button>
        </div>
        <textarea
          className="w-full min-h-[200px] rounded-md border border-input bg-card text-card-foreground p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Clique em 'Gerar com IA' para criar uma justificativa técnica baseada nos dados do projeto, ou escreva manualmente..."
          value={justification}
          onChange={e => setJustification(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-2">
          O texto gerado é editável. Revise antes de incluir no memorial descritivo.
        </p>
      </section>

      {/* Actions */}
      <div className="flex justify-end items-center gap-3 pt-4 flex-wrap">
        <Button
          type="button"
          onClick={() => setArtGuideOpen(true)}
          variant="outline"
          className="border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-4 py-2.5 shadow-sm text-sm flex items-center gap-2"
          title="Guia Rápido de Preenchimento de ART (CREA) e TRT (CFT)"
        >
          <Award size={18} className="text-amber-500" />
          📋 Guia ART / TRT (CREA & CFT)
        </Button>

        <Button
          type="button"
          onClick={() => setPreFlightOpen(true)}
          variant="outline"
          className="border-blue-500/40 hover:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold px-4 py-2.5 shadow-sm text-sm flex items-center gap-2"
          title="Auditoria Técnica Pré-Protocolo (Checklist Anti-Exigência)"
        >
          <ShieldCheck size={18} className="text-blue-500" />
          🛡️ Auditoria Pré-Protocolo
        </Button>

        <Button
          type="button"
          onClick={handleGenerateUtilityAccessForm}
          variant="outline"
          className="border-brand-500/40 hover:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold px-4 py-2.5 shadow-sm text-sm flex items-center gap-2"
          title={`Gera o formulário oficial de solicitação de acesso para ${getUtilityShortLabel(data.technical.utility)}`}
        >
          <FileSpreadsheet size={18} className="text-brand-500" />
          📄 Formulário de Acesso ({getUtilityShortLabel(data.technical.utility)})
        </Button>

        <button
          onClick={() => {
            const preFlight = validateProjectPreFlight(data);
            if (!preFlight.canProtocol) {
              setPreFlightOpen(true);
              toast.error('Exigências críticas detectadas no pré-protocolo. Revise antes de emitir!');
            } else if (engResult.overallStatus !== 'SUCCESS') {
              setShowWarningModal(true);
            } else {
              onGenerate();
            }
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-md font-bold shadow-lg transition-all bg-primary text-primary-foreground hover:bg-brand-700 hover:shadow-xl"
        >
          <FileText size={20} />
          Gerar Memorial Descritivo (PDF)
        </button>
      </div>

      {/* Guia ART / TRT Modal */}
      <ArtGuideModal
        open={artGuideOpen}
        onOpenChange={setArtGuideOpen}
        project={data}
      />

      {/* Pre-Flight Audit Modal */}
      <PreFlightAuditModal
        open={preFlightOpen}
        onOpenChange={setPreFlightOpen}
        project={data}
        onProceedAnyway={() => {
          if (engResult.overallStatus !== 'SUCCESS') {
            setShowWarningModal(true);
          } else {
            onGenerate();
          }
        }}
      />

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Divergências Técnicas Encontradas
            </DialogTitle>
            <DialogDescription>
              Deseja prosseguir com a geração mesmo com divergências técnicas?
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-2 my-2">
            {engResult.globalWarnings.map((w, i) => (
              <div key={`gw-${i}`} className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 p-2 rounded">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
            {engResult.blocks.map((block) =>
              block.warnings.map((w, i) => (
                <div key={`b${block.blockId}-${i}`} className="flex items-start gap-2 text-sm text-warning bg-warning/5 p-2 rounded">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Conjunto {block.blockId}: {w}</span>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWarningModal(false)}>
              Corrigir Agora
            </Button>
            <Button
              onClick={() => {
                setShowWarningModal(false);
                onGenerate();
              }}
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
            >
              <FileText size={16} />
              Gerar Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
