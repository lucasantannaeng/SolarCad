import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  UserCheck,
  FileCheck2,
  Search,
  CheckCircle,
  Loader2,
  ShieldCheck,
  FileText,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import {
  CompanyProfile,
  UtilityCompany,
} from '@/types';
import {
  useCompanyProfile,
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCEP,
  fetchCNPJData,
} from '@/hooks/useCompanyProfile';
import { UTILITIES } from '@/constants';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: (profile: CompanyProfile) => void;
}

const inputClass = "w-full text-xs p-2 rounded-md border border-input bg-background text-foreground focus:ring-1 focus:ring-brand-500 focus:border-brand-500 shadow-sm";
const labelClass = "text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1";

export const CompanyProfileModal: React.FC<Props> = ({ open, onOpenChange, onProfileUpdated }) => {
  const { profile: savedProfile, saveProfile, loading } = useCompanyProfile();
  const [formData, setFormData] = useState<CompanyProfile>(savedProfile);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [activeTab, setActiveTab] = useState<'company' | 'representative' | 'defaults'>('company');

  useEffect(() => {
    if (open) {
      setFormData(savedProfile);
    }
  }, [open, savedProfile]);

  const handleCnpjSearch = async () => {
    const clean = formData.cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      toast.warning('Digite um CNPJ válido com 14 dígitos para buscar.');
      return;
    }

    setSearchingCNPJ(true);
    try {
      const data = await fetchCNPJData(clean);
      if (data) {
        setFormData(prev => ({
          ...prev,
          companyName: data.companyName || prev.companyName,
          tradeName: data.tradeName || prev.tradeName,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          address: {
            ...prev.address,
            street: data.street || prev.address.street,
            number: data.number || prev.address.number,
            neighborhood: data.neighborhood || prev.address.neighborhood,
            city: data.city || prev.address.city,
            state: data.state || prev.address.state,
            zipCode: data.zipCode || prev.address.zipCode,
          },
        }));
        toast.success(`Dados da empresa "${data.tradeName || data.companyName}" carregados com sucesso via Receita!`);
      } else {
        toast.error('CNPJ não localizado na base da Receita Federal.');
      }
    } catch {
      toast.error('Falha ao consultar CNPJ.');
    } finally {
      setSearchingCNPJ(false);
    }
  };

  const handleSave = async () => {
    if (!formData.companyName && !formData.tradeName) {
      toast.warning('Informe pelo menos a Razão Social ou Nome Fantasia da Empresa.');
      return;
    }

    await saveProfile(formData);
    if (onProfileUpdated) {
      onProfileUpdated(formData);
    }
    toast.success('Perfil da Empresa Integradora e Procurador salvo com sucesso!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground font-bold">
            <Building2 className="w-5 h-5 text-brand-500" />
            Cadastro da Empresa Integradora & Procurador Legal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure os dados corporativos e profissionais uma única vez. Eles serão inseridos automaticamente em novos projetos, memoriais, formulários de concessionárias e procurações.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-2">
          <TabsList className="grid grid-cols-3 w-full bg-muted/60">
            <TabsTrigger value="company" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background">
              <Building2 className="w-3.5 h-3.5 text-brand-500" />
              1. Empresa Integradora
            </TabsTrigger>
            <TabsTrigger value="representative" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background">
              <UserCheck className="w-3.5 h-3.5 text-brand-500" />
              2. Procurador / RT
            </TabsTrigger>
            <TabsTrigger value="defaults" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-background">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
              3. Padrões & Homologação
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EMPRESA INTEGRADORA */}
          <TabsContent value="company" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label className={labelClass}>CNPJ da Empresa</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCnpjSearch}
                    disabled={searchingCNPJ}
                    className="shrink-0 text-xs gap-1 border-brand-500/50 hover:bg-brand-500/10 text-brand-500"
                  >
                    {searchingCNPJ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar CNPJ
                  </Button>
                </div>
              </div>
              <div>
                <Label className={labelClass}>Inscrição Estadual (Opcional)</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ex: 12.345.678"
                  value={formData.stateRegistration || ''}
                  onChange={(e) => setFormData({ ...formData, stateRegistration: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>Razão Social</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Nome Empresarial Completo LTDA"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div>
                <Label className={labelClass}>Nome Fantasia</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Nome Comercial / Marca"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>
                  <Mail className="w-3 h-3 text-muted-foreground" /> E-mail Comercial
                </Label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="contato@empresa.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label className={labelClass}>
                  <Phone className="w-3 h-3 text-muted-foreground" /> Telefone / WhatsApp
                </Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                />
              </div>
            </div>

            {/* Endereço da Empresa */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2 mt-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-500" /> Endereço Comercial da Sede
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <Label className={labelClass}>Logradouro (Rua, Av, Rodovia)</Label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Av. das Américas"
                    value={formData.address?.street || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, street: e.target.value },
                    })}
                  />
                </div>
                <div>
                  <Label className={labelClass}>Número</Label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="1000, Sala 201"
                    value={formData.address?.number || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, number: e.target.value },
                    })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <Label className={labelClass}>Bairro</Label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Barra da Tijuca"
                    value={formData.address?.neighborhood || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, neighborhood: e.target.value },
                    })}
                  />
                </div>
                <div>
                  <Label className={labelClass}>Cidade</Label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Rio de Janeiro"
                    value={formData.address?.city || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, city: e.target.value },
                    })}
                  />
                </div>
                <div>
                  <Label className={labelClass}>UF</Label>
                  <input
                    type="text"
                    maxLength={2}
                    className={inputClass}
                    placeholder="RJ"
                    value={formData.address?.state || 'RJ'}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, state: e.target.value.toUpperCase() },
                    })}
                  />
                </div>
                <div>
                  <Label className={labelClass}>CEP</Label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="22000-000"
                    value={formData.address?.zipCode || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, zipCode: formatCEP(e.target.value) },
                    })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: PROCURADOR LEGAL E RESPONSÁVEL TÉCNICO */}
          <TabsContent value="representative" className="space-y-3 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>Nome do Responsável Técnico / Procurador</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Nome Completo do Engenheiro"
                  value={formData.legalRepresentative?.name || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, name: e.target.value },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>Qualificação Profissional</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ex: Engenheiro Eletricista / Diretor Técnico"
                  value={formData.legalRepresentative?.qualification || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, qualification: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className={labelClass}>CPF</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="000.000.000-00"
                  value={formData.legalRepresentative?.cpf || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, cpf: formatCPF(e.target.value) },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>RG (Identidade Civil)</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ex: 00.000.000-0"
                  value={formData.legalRepresentative?.rg || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, rg: e.target.value },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>Órgão Emissor do RG</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="DETRAN/RJ, SSP/SP"
                  value={formData.legalRepresentative?.rgIssuer || 'DETRAN/RJ'}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, rgIssuer: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className={labelClass}>Registro Profissional (CREA ou CFT)</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ex: 2012105489"
                  value={formData.legalRepresentative?.creaCft || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, creaCft: e.target.value },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>UF do Conselho Regional</Label>
                <input
                  type="text"
                  maxLength={2}
                  className={inputClass}
                  placeholder="RJ"
                  value={formData.legalRepresentative?.creaState || 'RJ'}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, creaState: e.target.value.toUpperCase() },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>RNP (Registro Nacional Profissional)</Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ex: 1409823450"
                  value={formData.legalRepresentative?.rnp || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, rnp: e.target.value },
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>
                  <Mail className="w-3 h-3 text-muted-foreground" /> E-mail do Responsável Técnico
                </Label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="engenharia@empresa.com.br"
                  value={formData.legalRepresentative?.email || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, email: e.target.value },
                  })}
                />
              </div>
              <div>
                <Label className={labelClass}>
                  <Phone className="w-3 h-3 text-muted-foreground" /> Celular / WhatsApp do RT
                </Label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="(00) 00000-0000"
                  value={formData.legalRepresentative?.phone || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalRepresentative: { ...formData.legalRepresentative, phone: formatPhone(e.target.value) },
                  })}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: PADRÕES & HOMOLOGAÇÃO */}
          <TabsContent value="defaults" className="space-y-4 pt-3">
            <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-3">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-brand-500" /> Preferências de Homologação Padrão
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Concessionária Padrão Mais Frequente</Label>
                  <select
                    className={inputClass}
                    value={formData.defaultUtility || UtilityCompany.LIGHT}
                    onChange={(e) => setFormData({ ...formData, defaultUtility: e.target.value as UtilityCompany })}
                  >
                    {UTILITIES.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Tipo Padrão de ART / TRT</Label>
                  <select
                    className={inputClass}
                    value={formData.defaultArtType || 'OBRA_SERVICO'}
                    onChange={(e) => setFormData({ ...formData, defaultArtType: e.target.value as any })}
                  >
                    <option value="OBRA_SERVICO">Obra ou Serviço (Individual por Usina)</option>
                    <option value="CARGO_FUNCAO">Cargo ou Função (Vinculada à Empresa)</option>
                    <option value="MULTIPLA">Múltipla Mensal / Contrato Contínuo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-brand-500/20 bg-brand-500/5 space-y-2 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <FileText className="w-4 h-4 text-brand-500" />
                Emissão Instantânea de Procuração GD
              </div>
              <p>
                Com este perfil cadastrado, você pode emitir a <strong>Procuração GD Oficial</strong> outorgando poderes ao seu procurador técnico com apenas 1 clique em qualquer projeto aberto.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
            className="text-xs bg-brand-600 hover:bg-brand-700 text-white gap-1.5 shadow-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Salvar Perfil da Empresa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
