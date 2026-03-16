import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Segments organized by category
const SEGMENT_CATEGORIES = [
  {
    category: "SAÚDE & BEM-ESTAR",
    segments: [
      "Clínicas médicas",
      "Clínicas odontológicas",
      "Clínicas estéticas",
      "Clínicas de harmonização facial",
      "Clínicas de fisioterapia",
      "Clínicas de psicologia",
      "Clínicas veterinárias",
      "Laboratórios de exames",
      "Clínicas populares",
      "Centros de diagnóstico",
    ],
  },
  {
    category: "EDUCAÇÃO & TREINAMENTO",
    segments: [
      "Escolas particulares",
      "Faculdades privadas",
      "Cursos profissionalizantes",
      "Escolas técnicas",
      "Cursos livres",
      "Escolas de idiomas",
      "Edtechs",
      "Treinamentos corporativos",
      "Cursos preparatórios (ENEM, concursos)",
      "Escolas de pós-graduação",
    ],
  },
  {
    category: "IMOBILIÁRIO & CONSTRUÇÃO",
    segments: [
      "Imobiliárias residenciais",
      "Imobiliárias comerciais",
      "Incorporadoras",
      "Construtoras",
      "Loteadoras",
      "Correspondentes imobiliários",
      "Administradoras de condomínios",
      "Corretores autônomos organizados",
      "Franquias imobiliárias",
      "Portais regionais de imóveis",
    ],
  },
  {
    category: "VAREJO & COMÉRCIO",
    segments: [
      "Lojas de varejo físico",
      "Redes de lojas",
      "Franquias de varejo",
      "E-commerces",
      "Lojas Instagram / social commerce",
      "Marketplaces sellers",
      "Lojas de móveis",
      "Lojas de eletrodomésticos",
      "Lojas de moda",
      "Distribuidores regionais",
    ],
  },
  {
    category: "SERVIÇOS PROFISSIONAIS",
    segments: [
      "Escritórios de contabilidade",
      "Escritórios de advocacia",
      "Consultorias empresariais",
      "Agências de marketing",
      "Agências de publicidade",
      "Agências de tráfego pago",
      "Agências de lançamento",
      "BPO financeiro",
      "BPO de RH",
      "Empresas de terceirização",
    ],
  },
  {
    category: "AUTOMOTIVO & TRANSPORTE",
    segments: [
      "Concessionárias de veículos",
      "Revendas de seminovos",
      "Locadoras de veículos",
      "Oficinas mecânicas",
      "Auto centers",
      "Empresas de rastreamento veicular",
      "Despachantes",
      "Empresas de transporte executivo",
      "Frotistas",
      "Empresas de logística urbana",
    ],
  },
  {
    category: "FINANCEIRO & SEGUROS",
    segments: [
      "Corretoras de seguros",
      "Seguradoras regionais",
      "Correspondentes bancários",
      "Consórcios",
      "Financeiras",
      "Cooperativas de crédito",
      "Escritórios de investimentos",
      "Proteção veicular",
      "Recuperação de crédito",
      "Cobrança extrajudicial",
    ],
  },
  {
    category: "TURISMO & HOSPITALIDADE",
    segments: [
      "Agências de viagem",
      "Operadoras de turismo",
      "Hotéis",
      "Pousadas",
      "Resorts",
      "Aluguel por temporada",
      "Empresas de intercâmbio",
      "Turismo médico",
      "Excursões regionais",
      "Guias turísticos organizados",
    ],
  },
  {
    category: "TECNOLOGIA & ASSINATURAS",
    segments: [
      "SaaS B2B",
      "SaaS vertical (ERP, CRM, nichados)",
      "Empresas de software sob demanda",
      "Provedores de internet (ISP)",
      "Empresas de telefonia local",
      "Empresas de TI e suporte técnico",
      "Plataformas de assinatura",
      "Empresas de automação comercial",
      "Revendas de software",
      "Empresas de cloud / MSP",
    ],
  },
  {
    category: "SERVIÇOS AO CONSUMIDOR FINAL",
    segments: [
      "Clínicas de estética automotiva",
      "Empresas de limpeza",
      "Dedetizadoras",
      "Empresas de segurança eletrônica",
      "Portarias remotas",
      "Escolas de esporte",
      "Academias",
      "Studios de personal trainer",
      "Serviços de manutenção residencial",
      "Assistência técnica (celular, eletrônicos)",
    ],
  },
  {
    category: "OUTROS",
    segments: ["Outros"],
  },
];

// Flatten all segments for search
const ALL_SEGMENTS = SEGMENT_CATEGORIES.flatMap((cat) =>
  cat.segments.map((seg) => ({
    value: seg,
    label: seg,
    category: cat.category,
  }))
);

interface SegmentComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SegmentCombobox({ value, onChange }: SegmentComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter segments based on search
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery) return SEGMENT_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return SEGMENT_CATEGORIES.map((cat) => ({
      ...cat,
      segments: cat.segments.filter(
        (seg) =>
          seg.toLowerCase().includes(query) ||
          cat.category.toLowerCase().includes(query)
      ),
    })).filter((cat) => cat.segments.length > 0);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background font-normal"
        >
          {value || "Selecione o segmento"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar segmento..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Nenhum segmento encontrado.</CommandEmpty>
            {filteredCategories.map((cat) => (
              <CommandGroup key={cat.category} heading={cat.category}>
                {cat.segments.map((segment) => (
                  <CommandItem
                    key={segment}
                    value={segment}
                    onSelect={() => {
                      onChange(segment);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === segment ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {segment}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
