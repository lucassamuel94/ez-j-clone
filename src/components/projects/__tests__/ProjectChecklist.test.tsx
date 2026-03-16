import { describe, it, expect, vi, beforeEach } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - testing library re-exports from @testing-library/dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectChecklist } from '../ProjectChecklist';
import type { CloserOpportunity } from '@/services/closerService';

// Mock useCreateProject
const mockMutateAsync = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/useProjects', () => ({
  useCreateProject: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

// Mock RichTextEditor (TipTap doesn't work in jsdom)
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({ content, onChange, placeholder }: any) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock PhoneInput
vi.mock('@/components/PhoneInput', () => ({
  PhoneInput: ({ value, onChange }: any) => (
    <input
      data-testid="phone-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock Radix ScrollArea
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const baseOpportunity: CloserOpportunity = {
  id: 'opp-1',
  lead_id: 'lead-1',
  stage: 'Demonstração',
  created_by_user_id: 'user-1',
  assigned_to_user_id: 'closer-1',
  sdr_user_id: 'sdr-1',
  closer_notes: null,
  returned_to_sdr: false,
  return_reason: null,
  lost_reason: null,
  meeting_datetime: null,
  deal_value: 5000,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
  active_objection: null,
  expected_close_date: null,
  decision_maker_identified: false,
  lead_name: 'João Silva',
  lead_company: 'Empresa Teste',
  lead_razao_social: 'Empresa Teste LTDA',
  lead_cnpj: '12.345.678/0001-90',
  lead_phone: '11999990000',
  lead_email: 'joao@empresa.com',
};

describe('ProjectChecklist', () => {
  const mockOnSuccess = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderChecklist = (props: Partial<Parameters<typeof ProjectChecklist>[0]> = {}) => {
    return render(
      <ProjectChecklist
        open={true}
        onOpenChange={mockOnOpenChange}
        opportunity={baseOpportunity}
        onSuccess={mockOnSuccess}
        {...props}
      />,
      { wrapper: createWrapper() },
    );
  };

  // ───────── Rendering ─────────

  it('renders modal title and company name', () => {
    renderChecklist();
    expect(screen.getByText('Checklist de Projeto — Ganho')).toBeInTheDocument();
    expect(screen.getByText('Empresa Teste')).toBeInTheDocument();
  });

  it('pre-fills company data from opportunity', () => {
    renderChecklist();
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const razaoInput = inputs.find((i) => i.value === 'Empresa Teste LTDA');
    const cnpjInput = inputs.find((i) => i.value === '12.345.678/0001-90');
    expect(razaoInput).toBeTruthy();
    expect(cnpjInput).toBeTruthy();
  });

  it('pre-fills client responsible fields from opportunity', () => {
    renderChecklist();
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const nomeInput = inputs.find((i) => i.value === 'João Silva');
    expect(nomeInput).toBeTruthy();
    // Email
    const emailInput = inputs.find((i) => i.value === 'joao@empresa.com');
    expect(emailInput).toBeTruthy();
  });

  it('renders all 5 section headers', () => {
    renderChecklist();
    expect(screen.getByText('Tipo de Projeto')).toBeInTheDocument();
    expect(screen.getByText('Dados da Empresa')).toBeInTheDocument();
    expect(screen.getByText('Responsável do Cliente')).toBeInTheDocument();
    expect(screen.getByText('Configurações')).toBeInTheDocument();
    // Description only visible for venda/evolucao (default is venda)
    expect(screen.getByText('Descrição do Projeto')).toBeInTheDocument();
  });

  // ───────── Validation ─────────

  it('disables submit when CNPJ is empty', () => {
    render(
      <ProjectChecklist
        open={true}
        onOpenChange={mockOnOpenChange}
        opportunity={{ ...baseOpportunity, lead_cnpj: '' }}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() },
    );
    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('disables submit when versão is not selected (default state)', () => {
    renderChecklist();
    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    // versao starts empty, so button should be disabled
    expect(submitBtn).toBeDisabled();
  });

  it('disables submit when responsável nome is empty', () => {
    render(
      <ProjectChecklist
        open={true}
        onOpenChange={mockOnOpenChange}
        opportunity={{ ...baseOpportunity, lead_name: '' }}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() },
    );
    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  // ───────── Submission — Venda ─────────

  it('submits correct checklist data for Venda type', async () => {
    renderChecklist();

    // Select versão V2
    const versaoTrigger = screen.getByText('Selecionar versão...');
    fireEvent.click(versaoTrigger);
    await waitFor(() => {
      const v2Option = screen.getByText('V2');
      fireEvent.click(v2Option);
    });

    // Select tempo de armazenamento
    const tempoTrigger = screen.getByText('Selecionar...');
    fireEvent.click(tempoTrigger);
    await waitFor(() => {
      const option = screen.getByText('2 anos');
      fireEvent.click(option);
    });

    // Submit
    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      const callArgs = mockMutateAsync.mock.calls[0][0];

      expect(callArgs.opportunity_id).toBe('opp-1');
      expect(callArgs.lead_id).toBe('lead-1');
      expect(callArgs.project_type).toBe('venda');
      expect(callArgs.closer_user_id).toBe('closer-1');
      expect(callArgs.sdr_user_id).toBe('sdr-1');

      const checklist = callArgs.checklist_data;
      expect(checklist.type).toBe('venda');
      expect(checklist.razao_social).toBe('Empresa Teste LTDA');
      expect(checklist.cnpj).toBe('12.345.678/0001-90');
      expect(checklist.versao).toBe('V2');
      expect(checklist.responsavel_nome).toBe('João Silva');
      expect(checklist.responsavel_telefone).toBe('11999990000');
      expect(checklist.responsavel_email).toBe('joao@empresa.com');
      expect(checklist.tempo_armazenamento).toBe('2_anos');
    });
  });

  it('calls onSuccess and onOpenChange(false) after successful submit', async () => {
    renderChecklist();

    // Fill required fields: versão + tempo armazenamento
    const versaoTrigger = screen.getByText('Selecionar versão...');
    fireEvent.click(versaoTrigger);
    await waitFor(() => fireEvent.click(screen.getByText('V2')));

    const tempoTrigger = screen.getByText('Selecionar...');
    fireEvent.click(tempoTrigger);
    await waitFor(() => fireEvent.click(screen.getByText('1 ano')));

    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // ───────── Cancelar ─────────

  it('calls onOpenChange(false) when Cancelar is clicked', () => {
    renderChecklist();
    const cancelBtn = screen.getByText('Cancelar');
    fireEvent.click(cancelBtn);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // ───────── isValid logic ─────────

  it('isValid returns false when razaoSocial is empty for venda', () => {
    render(
      <ProjectChecklist
        open={true}
        onOpenChange={mockOnOpenChange}
        opportunity={{ ...baseOpportunity, lead_razao_social: '', lead_company: '' }}
        onSuccess={mockOnSuccess}
      />,
      { wrapper: createWrapper() },
    );
    const submitBtn = screen.getByText('Confirmar Ganho e Criar Projeto').closest('button');
    expect(submitBtn).toBeDisabled();
  });
});
