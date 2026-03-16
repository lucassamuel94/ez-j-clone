# API EzCall – Exemplo de uso

## Autenticação

**Tipo:** Bearer

Enviar o token no header:

```
Authorization: Bearer <seu_token>
```

---

## Endpoint: Relatório de chamadas (outgoing)

**URL:**  
`https://ezsoft.br2.ezcall.com.br/ezcall/api/call/reports/recent/outgoing/`

**Método:** GET

### Parâmetros da query

| Parâmetro   | Exemplo     | Descrição |
|------------|-------------|-----------|
| `startDate` | 2026-03-06  | Data inicial |
| `endDate`   | 2026-03-06  | Data final |
| `search`    | 3060        | Ramal a ser buscado |
| `disposition` | ANSWERED  | Apenas chamadas atendidas (originadas) |
| `pagination` | 100       | Quantidade de registros de ligações por página |

### Exemplo de URL completa

```
https://ezsoft.br2.ezcall.com.br/ezcall/api/call/reports/recent/outgoing/?startDate=2026-03-06&endDate=2026-03-06&search=3060&disposition=ANSWERED&pagination=100
```

### Exemplo de retorno

```json
{
    "current_page": 1,
    "data": [
        {
            "type": "OUTGOING",
            "uniqueid": "1772827465.7187",
            "linkedid": "1772827465.7187",
            "queue_id": null,
            "calldate": "2026-03-06 17:04:25",
            "src": "3060",
            "dst": "14999075454",
            "extension": "3060",
            "answered": 1,
            "disposition": "ANSWERED",
            "duration": 45,
            "billsec": 40
        }
    ],
    "first_page_url": "/?page=1",
    "from": 1,
    "last_page": 18,
    "last_page_url": "/?page=18",
    "next_page_url": "/?page=2",
    "path": "/",
    "per_page": "1",
    "prev_page_url": null,
    "to": 1,
    "total": 18,
    "execution_time": 0.05702996253967285
}
```

### Campos de `data[]`

Cada elemento de `data` é um registro de chamada com os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Tipo da chamada (ex.: OUTGOING = saída) |
| `uniqueid` | string | ID único da chamada no Asterisk |
| `linkedid` | string | ID de vínculo da chamada; usado no endpoint de gravação (`load-record`) |
| `queue_id` | number \| null | ID da fila, se a chamada passou por fila |
| `calldate` | string | Data e hora da chamada (ex.: 2026-03-06 17:04:25) |
| `src` | string | Origem (ramal/origem da chamada) |
| `dst` | string | Destino (número discado) |
| `extension` | string | Ramal (extensão) |
| `answered` | number | 1 = atendida, 0 = não atendida |
| `disposition` | string | Situação da chamada (ex.: ANSWERED, NO ANSWER, BUSY) |
| `duration` | number | Duração total em segundos (incluindo toque) |
| `billsec` | number | Tempo efetivamente cobrado/faturado em segundos (após atender) |

O campo **`linkedid`** de cada item em `data` é usado para baixar o áudio da gravação (ver endpoint abaixo).

---

## Endpoint: Arquivo de gravação (stream)

**URL:**  
`https://ezsoft.br2.ezcall.com.br/ezcall/api/files/load-record/:linkedid`

**Método:** GET

- **`:linkedid`** – ID da chamada retornado no relatório (campo `linkedid` do item em `data`).

### Exemplo

```
https://ezsoft.br2.ezcall.com.br/ezcall/api/files/load-record/1772827465.7187
```

**Retorno:** buffer de áudio (stream).

---

## Fluxo resumido

1. Chamar o endpoint de **relatório** com `startDate`, `endDate`, `search`, `disposition`, `pagination`.
2. Usar o **`linkedid`** de cada registro em `data`.
3. Chamar o endpoint **load-record** com esse `linkedid` para obter o buffer de áudio da gravação.
