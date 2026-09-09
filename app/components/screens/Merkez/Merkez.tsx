"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type CenterState = {
  loading: boolean;
  success: boolean;
  error: string;
  data: any;
};

type ChannelCode =
  | "N11"
  | "IKAS"
  | "IDEFIX";

type AddDeviceForm = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: "A" | "B" | "C";
  warranty: string;
};

const EMPTY_ADD_DEVICE_FORM: AddDeviceForm = {
  imei: "",
  brand: "",
  model: "",
  memory: "",
  color: "",
  grade: "A",
  warranty: "12 Ay",
};

type BulkPreviewError = {
  imei: string;
  reason: string;
  type: string;
};

type BulkPreview = {
  total: number;
  valid: number;
  invalid: number;
  canCommit: boolean;
  errors: BulkPreviewError[];
};


type ExcelDeviceRow = {
  rowNumber: number;
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
};

type ExcelPreviewError = {
  rowNumber: number;
  imei: string;
  reason: string;
  type: string;
};

type ExcelPreview = {
  total: number;
  valid: number;
  invalid: number;
  canCommit: boolean;
  errors: ExcelPreviewError[];
};


type ChannelSendPreviewItem = {
  deviceId: number;
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  status: string;
  eligible: boolean;
  errors: string[];
  existingChannelStatus:
    string | null;
};

type ChannelSendPreview = {
  channel: ChannelCode;
  salePrice: number;
  listPrice: number;
  total: number;
  eligible: number;
  blocked: number;
  canProceed: boolean;
  items:
    ChannelSendPreviewItem[];
};


type N11SendResult = {
  deviceId: number;
  imei: string;
  success: boolean;
  status:
    | "LISTED"
    | "PENDING_CREATE"
    | "ERROR";
  message: string;
  listingId:
    | number
    | null;
  externalProductId:
    | string
    | null;
};


type IkasSendGroupResult = {
  success: boolean;
  action:
    | "EXISTING_VARIANT"
    | "ADD_VARIANT"
    | "CREATE_PRODUCT";
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  color: string;
  addedImeis: string[];
  addedCount: number;
  beforeStock: number;
  afterStock: number;
  salePrice: number;
  listPrice: number;
  stockLocationId: string;
  salesChannelVisibility?: {
    id: string;
    name: string;
    status: string;
    selectedBy: string;
  };
  listingId: number;
};


type IdefixSendGroupResult = {
  success: boolean;
  action:
    | "EXISTING_PRODUCT"
    | "FAST_LISTING"
    | "CREATE_PRODUCT";
  title: string;
  color: string;
  barcode: string;
  beforeStock: number;
  afterStock: number;
  addedImeis: string[];
  batchRequestId:
    | string
    | null;
  inventoryBatchRequestId?:
    | string
    | null;
  listingId: number;
  state:
    | "LISTED"
    | "PENDING_CREATE"
    | string;
  pendingApproval?: boolean;
  approved?: boolean;
  message?: string;
};







function normalizeExcelHeader(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleUpperCase(
      "tr-TR"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^A-Z0-9]+/g,
      ""
    );
}

function excelColumnIndex(
  cellRef: string
) {
  const letters =
    cellRef
      .replace(
        /[^A-Za-z]/g,
        ""
      )
      .toUpperCase();

  let value = 0;

  for (
    let index = 0;
    index <
    letters.length;
    index += 1
  ) {
    value =
      value * 26 +
      (
        letters.charCodeAt(
          index
        ) -
        64
      );
  }

  return value - 1;
}

function readUint16LE(
  view: DataView,
  offset: number
) {
  return view.getUint16(
    offset,
    true
  );
}

function readUint32LE(
  view: DataView,
  offset: number
) {
  return view.getUint32(
    offset,
    true
  );
}

async function unzipXlsxEntries(
  buffer: ArrayBuffer
) {
  const view =
    new DataView(
      buffer
    );

  let eocd = -1;

  const minOffset =
    Math.max(
      0,
      buffer.byteLength -
        65_557
    );

  for (
    let offset =
      buffer.byteLength -
      22;
    offset >= minOffset;
    offset -= 1
  ) {
    if (
      readUint32LE(
        view,
        offset
      ) === 0x06054b50
    ) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error(
      "Excel ZIP yapısı okunamadı."
    );
  }

  const totalEntries =
    readUint16LE(
      view,
      eocd + 10
    );

  const centralOffset =
    readUint32LE(
      view,
      eocd + 16
    );

  const decoder =
    new TextDecoder(
      "utf-8"
    );

  const entries =
    new Map<
      string,
      {
        method: number;
        compressedSize: number;
        localOffset: number;
      }
    >();

  let offset =
    centralOffset;

  for (
    let index = 0;
    index <
    totalEntries;
    index += 1
  ) {
    if (
      readUint32LE(
        view,
        offset
      ) !== 0x02014b50
    ) {
      throw new Error(
        "Excel merkezi ZIP dizini bozuk."
      );
    }

    const method =
      readUint16LE(
        view,
        offset + 10
      );

    const compressedSize =
      readUint32LE(
        view,
        offset + 20
      );

    const fileNameLength =
      readUint16LE(
        view,
        offset + 28
      );

    const extraLength =
      readUint16LE(
        view,
        offset + 30
      );

    const commentLength =
      readUint16LE(
        view,
        offset + 32
      );

    const localOffset =
      readUint32LE(
        view,
        offset + 42
      );

    const fileNameBytes =
      new Uint8Array(
        buffer,
        offset + 46,
        fileNameLength
      );

    const fileName =
      decoder.decode(
        fileNameBytes
      );

    entries.set(
      fileName,
      {
        method,
        compressedSize,
        localOffset,
      }
    );

    offset +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;
  }

  const readEntry =
    async (
      name: string
    ) => {
      const entry =
        entries.get(name);

      if (!entry) {
        return null;
      }

      const local =
        entry.localOffset;

      if (
        readUint32LE(
          view,
          local
        ) !== 0x04034b50
      ) {
        throw new Error(
          `Excel ZIP kaydı okunamadı: ${name}`
        );
      }

      const fileNameLength =
        readUint16LE(
          view,
          local + 26
        );

      const extraLength =
        readUint16LE(
          view,
          local + 28
        );

      const dataStart =
        local +
        30 +
        fileNameLength +
        extraLength;

      const compressed =
        new Uint8Array(
          buffer,
          dataStart,
          entry.compressedSize
        );

      let bytes:
        Uint8Array;

      if (
        entry.method === 0
      ) {
        bytes =
          compressed;
      } else if (
        entry.method === 8
      ) {
        if (
          typeof DecompressionStream ===
          "undefined"
        ) {
          throw new Error(
            "Tarayıcı Excel sıkıştırmasını desteklemiyor."
          );
        }

        const stream =
          new Blob([
            compressed,
          ])
            .stream()
            .pipeThrough(
              new DecompressionStream(
                "deflate-raw" as any
              )
            );

        bytes =
          new Uint8Array(
            await new Response(
              stream
            ).arrayBuffer()
          );
      } else {
        throw new Error(
          `Desteklenmeyen Excel sıkıştırma tipi: ${entry.method}`
        );
      }

      return decoder.decode(
        bytes
      );
    };

  return {
    readEntry,
  };
}

function parseExcelSheetXml(
  sheetXml: string,
  sharedStrings: string[]
) {
  const parser =
    new DOMParser();

  const xml =
    parser.parseFromString(
      sheetXml,
      "application/xml"
    );

  if (
    xml.querySelector(
      "parsererror"
    )
  ) {
    throw new Error(
      "Excel sayfası XML olarak okunamadı."
    );
  }

  const rows:
    Array<{
      rowNumber: number;
      cells: string[];
    }> = [];

  const rowNodes =
    Array.from(
      xml.getElementsByTagName(
        "row"
      )
    );

  for (
    const rowNode of
      rowNodes
  ) {
    const rowNumber =
      Number(
        rowNode.getAttribute(
          "r"
        ) || 0
      );

    const cells:
      string[] = [];

    const cellNodes =
      Array.from(
        rowNode.getElementsByTagName(
          "c"
        )
      );

    for (
      const cell of
        cellNodes
    ) {
      const ref =
        cell.getAttribute(
          "r"
        ) || "";

      const column =
        excelColumnIndex(
          ref
        );

      if (column < 0) {
        continue;
      }

      const type =
        cell.getAttribute(
          "t"
        ) || "";

      let value = "";

      if (
        type ===
        "inlineStr"
      ) {
        value =
          Array.from(
            cell.getElementsByTagName(
              "t"
            )
          )
            .map(
              (node) =>
                node.textContent ||
                ""
            )
            .join("");
      } else {
        const valueNode =
          cell.getElementsByTagName(
            "v"
          )[0];

        const rawValue =
          valueNode?.textContent ||
          "";

        if (
          type === "s"
        ) {
          const index =
            Number(
              rawValue
            );

          value =
            sharedStrings[
              index
            ] || "";
        } else if (
          type === "b"
        ) {
          value =
            rawValue === "1"
              ? "TRUE"
              : "FALSE";
        } else {
          value =
            rawValue;
        }
      }

      cells[column] =
        String(
          value ?? ""
        ).trim();
    }

    rows.push({
      rowNumber,
      cells,
    });
  }

  return rows;
}

async function parseCenterExcelFile(
  file: File
): Promise<
  ExcelDeviceRow[]
> {
  const lowerName =
    file.name.toLowerCase();

  if (
    !lowerName.endsWith(
      ".xlsx"
    )
  ) {
    throw new Error(
      "Şimdilik yalnızca .xlsx Excel dosyası yüklenebilir."
    );
  }

  if (
    file.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "Excel dosyası en fazla 10 MB olabilir."
    );
  }

  const buffer =
    await file.arrayBuffer();

  const zip =
    await unzipXlsxEntries(
      buffer
    );

  const sheetXml =
    await zip.readEntry(
      "xl/worksheets/sheet1.xml"
    );

  if (!sheetXml) {
    throw new Error(
      "Excel dosyasının ilk sayfası bulunamadı."
    );
  }

  const sharedXml =
    await zip.readEntry(
      "xl/sharedStrings.xml"
    );

  let sharedStrings:
    string[] = [];

  if (sharedXml) {
    const parser =
      new DOMParser();

    const xml =
      parser.parseFromString(
        sharedXml,
        "application/xml"
      );

    sharedStrings =
      Array.from(
        xml.getElementsByTagName(
          "si"
        )
      ).map(
        (node) =>
          Array.from(
            node.getElementsByTagName(
              "t"
            )
          )
            .map(
              (textNode) =>
                textNode.textContent ||
                ""
            )
            .join("")
      );
  }

  const rawRows =
    parseExcelSheetXml(
      sheetXml,
      sharedStrings
    );

  if (
    rawRows.length < 2
  ) {
    throw new Error(
      "Excel dosyasında cihaz satırı bulunamadı."
    );
  }

  const headerRow =
    rawRows.find(
      (row) =>
        row.cells.some(
          (cell) =>
            normalizeExcelHeader(
              cell
            ) === "IMEI"
        )
    ) ||
    rawRows[0];

  const headerMap =
    new Map<
      string,
      number
    >();

  headerRow.cells.forEach(
    (
      cell,
      index
    ) => {
      const key =
        normalizeExcelHeader(
          cell
        );

      if (key) {
        headerMap.set(
          key,
          index
        );
      }
    }
  );

  const findColumn =
    (
      keys: string[]
    ) => {
      for (
        const key of keys
      ) {
        const index =
          headerMap.get(
            key
          );

        if (
          index !==
          undefined
        ) {
          return index;
        }
      }

      return -1;
    };

  const columns = {
    imei:
      findColumn([
        "IMEI",
      ]),
    brand:
      findColumn([
        "MARKA",
        "BRAND",
      ]),
    model:
      findColumn([
        "MODEL",
      ]),
    memory:
      findColumn([
        "HAFIZA",
        "MEMORY",
        "KAPASITE",
      ]),
    color:
      findColumn([
        "RENK",
        "COLOR",
      ]),
    grade:
      findColumn([
        "GRADE",
        "KALITE",
      ]),
    warranty:
      findColumn([
        "GARANTI",
        "WARRANTY",
      ]),
  };

  const missing =
    Object.entries(
      columns
    )
      .filter(
        (
          [, index]
        ) =>
          index < 0
      )
      .map(
        ([key]) =>
          key
      );

  if (
    missing.length > 0
  ) {
    throw new Error(
      "Excel başlıkları eksik. Gerekli kolonlar: IMEI, Marka, Model, Hafıza, Renk, Grade, Garanti."
    );
  }

  const rows:
    ExcelDeviceRow[] = [];

  for (
    const rawRow of
      rawRows
  ) {
    if (
      rawRow.rowNumber <=
      headerRow.rowNumber
    ) {
      continue;
    }

    const get =
      (
        index: number
      ) =>
        String(
          rawRow.cells[
            index
          ] ?? ""
        ).trim();

    const imei =
      get(
        columns.imei
      );

    const brand =
      get(
        columns.brand
      );

    const model =
      get(
        columns.model
      );

    const memory =
      get(
        columns.memory
      );

    const color =
      get(
        columns.color
      );

    const grade =
      get(
        columns.grade
      );

    const warranty =
      get(
        columns.warranty
      );

    if (
      ![
        imei,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
      ].some(Boolean)
    ) {
      continue;
    }

    rows.push({
      rowNumber:
        rawRow.rowNumber,
      imei,
      brand,
      model,
      memory,
      color,
      grade,
      warranty,
    });
  }

  if (
    rows.length === 0
  ) {
    throw new Error(
      "Excel dosyasında cihaz satırı bulunamadı."
    );
  }

  if (
    rows.length > 500
  ) {
    throw new Error(
      "Tek Excel dosyasında en fazla 500 cihaz yüklenebilir."
    );
  }

  return rows;
}

function formatDateTime(
  value: unknown
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  ).format(date);
}

function normalize(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase(
      "tr-TR"
    );
}


function formatMoney(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "-";
  }

  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits:
        2,
    }
  ).format(number);
}

function channelLabel(
  channel: ChannelCode
) {
  if (
    channel === "IKAS"
  ) {
    return "İkas";
  }

  if (
    channel ===
    "IDEFIX"
  ) {
    return "İdefix";
  }

  return "N11";
}

function channelStatusMeta(
  rawStatus: unknown
) {
  const status =
    String(
      rawStatus ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    status === "LISTED"
  ) {
    return {
      label: "Gönderildi",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      mark: "✓",
    };
  }

  if (
    status ===
    "PENDING_CREATE"
  ) {
    return {
      label:
        "Hazırlanıyor",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      mark: "•",
    };
  }

  if (
    status ===
    "RESERVED"
  ) {
    return {
      label: "Rezerve",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
      mark: "●",
    };
  }

  if (
    status === "SOLD"
  ) {
    return {
      label: "Satıldı",
      className:
        "border-slate-300 bg-slate-100 text-slate-700",
      mark: "✓",
    };
  }

  if (
    status === "ERROR"
  ) {
    return {
      label: "Hata",
      className:
        "border-rose-200 bg-rose-50 text-rose-700",
      mark: "!",
    };
  }

  return {
    label:
      "Gönderilebilir",
    className:
      "border-slate-200 bg-white text-slate-500",
    mark: "+",
  };
}

function deviceStatusMeta(
  rawStatus: unknown
) {
  const status =
    String(
      rawStatus ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    status ===
    "AVAILABLE"
  ) {
    return {
      label: "Stokta",
      className:
        "bg-emerald-100 text-emerald-700",
    };
  }

  if (
    status ===
    "DETAILS_PENDING"
  ) {
    return {
      label:
        "Detay Bekliyor",
      className:
        "bg-amber-100 text-amber-700",
    };
  }

  if (
    status ===
    "REQUESTED"
  ) {
    return {
      label: "Talepte",
      className:
        "bg-violet-100 text-violet-700",
    };
  }

  if (
    status ===
    "TRANSFER_WAITING"
  ) {
    return {
      label:
        "Transfer Bekliyor",
      className:
        "bg-blue-100 text-blue-700",
    };
  }

  if (
    status === "SOLD"
  ) {
    return {
      label: "Satıldı",
      className:
        "bg-slate-200 text-slate-700",
    };
  }

  return {
    label:
      status || "-",
    className:
      "bg-slate-100 text-slate-600",
  };
}

function ChannelBadge({
  channel,
  status,
}: {
  channel: ChannelCode;
  status: unknown;
}) {
  const meta =
    channelStatusMeta(
      status
    );

  return (
    <div
      className={`inline-flex min-w-[104px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[7px] font-black uppercase tracking-wide ${meta.className}`}
      title={`${channel}: ${meta.label}`}
    >
      <span>
        {meta.mark}
      </span>
      <span>
        {meta.label}
      </span>
    </div>
  );
}

export default function Merkez() {
  const [
    center,
    setCenter,
  ] = useState<CenterState>({
    loading: true,
    success: false,
    error: "",
    data: null,
  });

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    onlyAvailable,
    setOnlyAvailable,
  ] = useState(true);

  const [
    expandedKey,
    setExpandedKey,
  ] = useState<
    string | null
  >(null);

  const [
    addOpen,
    setAddOpen,
  ] = useState(false);

  const [
    addForm,
    setAddForm,
  ] = useState<AddDeviceForm>(
    EMPTY_ADD_DEVICE_FORM
  );

  const [
    addSaving,
    setAddSaving,
  ] = useState(false);

  const [
    addError,
    setAddError,
  ] = useState("");

  const [
    addSuccess,
    setAddSuccess,
  ] = useState("");

  const [
    bulkOpen,
    setBulkOpen,
  ] = useState(false);

  const [
    bulkForm,
    setBulkForm,
  ] = useState<
    Omit<
      AddDeviceForm,
      "imei"
    >
  >({
    brand: "",
    model: "",
    memory: "",
    color: "",
    grade: "A",
    warranty: "12 Ay",
  });

  const [
    bulkImeis,
    setBulkImeis,
  ] = useState("");

  const [
    bulkPreview,
    setBulkPreview,
  ] = useState<
    BulkPreview | null
  >(null);

  const [
    bulkLoading,
    setBulkLoading,
  ] = useState(false);

  const [
    bulkError,
    setBulkError,
  ] = useState("");

  const [
    bulkSuccess,
    setBulkSuccess,
  ] = useState("");


  const excelInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    excelOpen,
    setExcelOpen,
  ] = useState(false);

  const [
    excelFileName,
    setExcelFileName,
  ] = useState("");

  const [
    excelRows,
    setExcelRows,
  ] = useState<
    ExcelDeviceRow[]
  >([]);

  const [
    excelPreview,
    setExcelPreview,
  ] = useState<
    ExcelPreview | null
  >(null);

  const [
    excelLoading,
    setExcelLoading,
  ] = useState(false);

  const [
    excelError,
    setExcelError,
  ] = useState("");

  const [
    excelSuccess,
    setExcelSuccess,
  ] = useState("");


  const [
    selectedDeviceIds,
    setSelectedDeviceIds,
  ] = useState<number[]>(
    []
  );

  const [
    channelOpen,
    setChannelOpen,
  ] = useState(false);

  const [
    sendChannel,
    setSendChannel,
  ] = useState<ChannelCode>(
    "N11"
  );

  const [
    channelSalePrice,
    setChannelSalePrice,
  ] = useState("");

  const [
    channelListPrice,
    setChannelListPrice,
  ] = useState("");

  const [
    idefixCatalogBarcode,
    setIdefixCatalogBarcode,
  ] = useState("");

  const [
    idefixNeedsCatalogBarcode,
    setIdefixNeedsCatalogBarcode,
  ] = useState(false);

  const [
    channelPreview,
    setChannelPreview,
  ] = useState<
    ChannelSendPreview | null
  >(null);

  const [
    channelLoading,
    setChannelLoading,
  ] = useState(false);

  const [
    channelError,
    setChannelError,
  ] = useState("");


  const [
    n11Sending,
    setN11Sending,
  ] = useState(false);

  const [
    n11SendResults,
    setN11SendResults,
  ] = useState<
    N11SendResult[]
  >([]);

  const [
    n11SendNotice,
    setN11SendNotice,
  ] = useState("");


  const [
    ikasSending,
    setIkasSending,
  ] = useState(false);

  const [
    ikasSendResults,
    setIkasSendResults,
  ] = useState<
    IkasSendGroupResult[]
  >([]);

  const [
    ikasSendNotice,
    setIkasSendNotice,
  ] = useState("");


  const [
    idefixSending,
    setIdefixSending,
  ] = useState(false);

  const [
    idefixSendResults,
    setIdefixSendResults,
  ] = useState<
    IdefixSendGroupResult[]
  >([]);

  const [
    idefixSendNotice,
    setIdefixSendNotice,
  ] = useState("");



  const loadCenter =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setCenter(
            (current) => ({
              ...current,
              loading: true,
              error: "",
            })
          );
        }

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method: "GET",
                cache:
                  "no-store",
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez API JSON dönmedi. HTTP ${response.status}. Route deploy edilmiş mi kontrol et.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "Merkez stoğu okunamadı."
            );
          }

          setCenter({
            loading: false,
            success: true,
            error: "",
            data: payload,
          });
        } catch (error) {
          setCenter(
            (current) => ({
              ...current,
              loading: false,
              error:
                error instanceof
                  Error
                  ? error.message
                  : "Merkez stoğu okunamadı.",
            })
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadCenter();
  }, [loadCenter]);

  const saveSingleDevice =
    useCallback(
      async () => {
        if (
          addSaving
        ) {
          return;
        }

        setAddError("");
        setAddSuccess("");

        const imei =
          addForm.imei.replace(
            /\D/g,
            ""
          );

        if (
          !/^[0-9]{15}$/.test(
            imei
          )
        ) {
          setAddError(
            "IMEI tam 15 hane olmalıdır."
          );
          return;
        }

        if (
          !addForm.brand.trim() ||
          !addForm.model.trim() ||
          !addForm.memory.trim() ||
          !addForm.color.trim() ||
          !addForm.grade.trim() ||
          !addForm.warranty.trim()
        ) {
          setAddError(
            "Tüm cihaz bilgilerini doldur."
          );
          return;
        }

        setAddSaving(true);

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    ...addForm,
                    imei,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez cihaz API JSON dönmedi. HTTP ${response.status}. Route deploy edilmiş mi kontrol et.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "Cihaz eklenemedi."
            );
          }

          setAddSuccess(
            `${imei} Merkez stoğuna eklendi.`
          );

          setAddForm(
            EMPTY_ADD_DEVICE_FORM
          );

          await loadCenter(
            true
          );
        } catch (error) {
          setAddError(
            error instanceof
              Error
              ? error.message
              : "Cihaz eklenemedi."
          );
        } finally {
          setAddSaving(false);
        }
      },
      [
        addForm,
        addSaving,
        loadCenter,
      ]
    );

  const runBulkDevice =
    useCallback(
      async (
        mode:
          | "preview"
          | "commit"
      ) => {
        if (
          bulkLoading
        ) {
          return;
        }

        setBulkError("");
        setBulkSuccess("");
        setBulkLoading(true);

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mode,
                    ...bulkForm,
                    imeis:
                      bulkImeis,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez toplu cihaz API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            if (
              payload?.preview
            ) {
              setBulkPreview(
                payload.preview
              );
            }

            throw new Error(
              payload?.error ||
                "Toplu cihaz işlemi başarısız."
            );
          }

          if (
            mode ===
            "preview"
          ) {
            setBulkPreview(
              payload.preview
            );

            if (
              payload?.preview
                ?.canCommit
            ) {
              setBulkSuccess(
                `${payload.preview.total} IMEI temiz. Kayda hazır.`
              );
            }

            return;
          }

          setBulkPreview(
            null
          );

          setBulkSuccess(
            payload?.message ||
              "Toplu cihaz kaydı tamamlandı."
          );

          setBulkImeis("");

          await loadCenter(
            true
          );
        } catch (error) {
          setBulkError(
            error instanceof
              Error
              ? error.message
              : "Toplu cihaz işlemi başarısız."
          );
        } finally {
          setBulkLoading(false);
        }
      },
      [
        bulkForm,
        bulkImeis,
        bulkLoading,
        loadCenter,
      ]
    );

  const runExcelDevice =
    useCallback(
      async (
        mode:
          | "preview"
          | "commit"
      ) => {
        if (
          excelLoading
        ) {
          return;
        }

        if (
          excelRows.length ===
          0
        ) {
          setExcelError(
            "Önce Excel dosyası seç."
          );
          return;
        }

        setExcelError("");
        setExcelSuccess("");
        setExcelLoading(true);

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mode,
                    rows:
                      excelRows,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez Excel API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            if (
              payload?.preview
            ) {
              setExcelPreview(
                payload.preview
              );
            }

            throw new Error(
              payload?.error ||
                "Excel cihaz işlemi başarısız."
            );
          }

          if (
            mode ===
            "preview"
          ) {
            setExcelPreview(
              payload.preview
            );

            if (
              payload?.preview
                ?.canCommit
            ) {
              setExcelSuccess(
                `${payload.preview.total} Excel satırı temiz. Kayda hazır.`
              );
            }

            return;
          }

          setExcelPreview(
            null
          );

          setExcelSuccess(
            payload?.message ||
              "Excel cihaz kaydı tamamlandı."
          );

          setExcelRows([]);

          await loadCenter(
            true
          );
        } catch (error) {
          setExcelError(
            error instanceof
              Error
              ? error.message
              : "Excel cihaz işlemi başarısız."
          );
        } finally {
          setExcelLoading(false);
        }
      },
      [
        excelRows,
        excelLoading,
        loadCenter,
      ]
    );

  const handleExcelFile =
    useCallback(
      async (
        file: File
      ) => {
        setExcelError("");
        setExcelSuccess("");
        setExcelPreview(
          null
        );
        setExcelRows([]);
        setExcelFileName(
          file.name
        );
        setExcelLoading(true);

        try {
          const rows =
            await parseCenterExcelFile(
              file
            );

          setExcelRows(
            rows
          );
          setExcelOpen(
            true
          );
        } catch (error) {
          setExcelError(
            error instanceof
              Error
              ? error.message
              : "Excel dosyası okunamadı."
          );
          setExcelOpen(
            true
          );
        } finally {
          setExcelLoading(false);
        }
      },
      []
    );

  const toggleDeviceSelection =
    useCallback(
      (
        deviceId: number
      ) => {
        setSelectedDeviceIds(
          (current) =>
            current.includes(
              deviceId
            )
              ? current.filter(
                  (id) =>
                    id !==
                    deviceId
                )
              : [
                  ...current,
                  deviceId,
                ]
        );

        setChannelPreview(
          null
        );
      },
      []
    );

  const openChannelSend =
    useCallback(
      (
        channel: ChannelCode
      ) => {
        if (
          selectedDeviceIds.length ===
          0
        ) {
          return;
        }

        setSendChannel(
          channel
        );
        setChannelSalePrice(
          ""
        );
        setChannelListPrice(
          ""
        );
        setIdefixCatalogBarcode(
          ""
        );
        setIdefixNeedsCatalogBarcode(
          false
        );
        setChannelPreview(
          null
        );
        setChannelError(
          ""
        );
        setN11SendResults(
          []
        );
        setN11SendNotice(
          ""
        );
        setIkasSendResults(
          []
        );
        setIkasSendNotice(
          ""
        );
        setIdefixSendResults(
          []
        );
        setIdefixSendNotice(
          ""
        );
        setChannelOpen(
          true
        );
      },
      [
        selectedDeviceIds,
      ]
    );

  const runChannelPreview =
    useCallback(
      async () => {
        if (
          channelLoading
        ) {
          return;
        }

        if (
          selectedDeviceIds.length ===
          0
        ) {
          setChannelError(
            "En az 1 IMEI seç."
          );
          return;
        }

        setChannelError(
          ""
        );
        setChannelPreview(
          null
        );
        setChannelLoading(
          true
        );

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    action:
                      "channel_preview",
                    channel:
                      sendChannel,
                    deviceIds:
                      selectedDeviceIds,
                    salePrice:
                      channelSalePrice,
                    listPrice:
                      channelListPrice,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez kanal ön kontrol API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "Kanal ön kontrolü başarısız."
            );
          }

          setChannelPreview(
            payload.preview
          );

          if (
            sendChannel ===
              "IDEFIX" &&
            payload.preview
              ?.canProceed
          ) {
            const idefixResponse =
              await fetch(
                "/api/online/idefix/center-send",
                {
                  method:
                    "POST",
                  cache:
                    "no-store",
                  credentials:
                    "same-origin",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      mode:
                        "preview",
                      deviceIds:
                        selectedDeviceIds,
                      salePrice:
                        channelSalePrice,
                      listPrice:
                        channelListPrice,
                      catalogBarcode:
                        idefixCatalogBarcode,
                    }),
                }
              );

            const idefixRaw =
              await idefixResponse.text();

            let idefixPayload:
              any = null;

            try {
              idefixPayload =
                idefixRaw
                  ? JSON.parse(
                      idefixRaw
                    )
                  : null;
            } catch {
              throw new Error(
                `İdefix ürün ön kontrol API JSON dönmedi. HTTP ${idefixResponse.status}.`
              );
            }

            const needsBarcode =
              Array.isArray(
                idefixPayload
                  ?.preview
              ) &&
              idefixPayload
                .preview
                .some(
                  (row: any) =>
                    row
                      ?.needsCatalogBarcode ===
                    true
                );

            setIdefixNeedsCatalogBarcode(
              needsBarcode
            );

            if (
              !idefixResponse.ok ||
              !idefixPayload
                ?.success
            ) {
              throw new Error(
                idefixPayload
                  ?.error ||
                  "İdefix ürün ön kontrolü başarısız."
              );
            }

            if (
              idefixPayload
                ?.canCommit !==
              true
            ) {
              if (
                needsBarcode
              ) {
                setChannelError(
                  "Bu ürün İdefix'te ilk kez eşleştirilecek. Katalog barkodunu bir kez gir; sonra direkt İdefix'e Gönder'e bas. Sonraki aynı ürünlerde barkod otomatik kullanılacak."
                );
                return;
              }

              const blockers =
                Array.isArray(
                  idefixPayload
                    ?.preview
                )
                  ? idefixPayload
                      .preview
                      .flatMap(
                        (
                          row: any
                        ) =>
                          Array.isArray(
                            row
                              ?.blockers
                          )
                            ? row
                                .blockers
                            : []
                      )
                  : [];

              setChannelError(
                blockers.length >
                0
                  ? blockers.join(
                      " | "
                    )
                  : "İdefix ürün ön kontrolü tamamlanamadı."
              );
              return;
            }

            setIdefixNeedsCatalogBarcode(
              false
            );
          }
        } catch (error) {
          setChannelError(
            error instanceof
              Error
              ? error.message
              : "Kanal ön kontrolü başarısız."
          );
        } finally {
          setChannelLoading(
            false
          );
        }
      },
      [
        selectedDeviceIds,
        sendChannel,
        channelSalePrice,
        channelListPrice,
        idefixCatalogBarcode,
        channelLoading,
      ]
    );

  const fetchFreshChannelPreview =
    useCallback(
      async () => {
        const response =
          await fetch(
            "/api/online/center/devices",
            {
              method:
                "PATCH",
              cache:
                "no-store",
              credentials:
                "same-origin",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  action:
                    "channel_preview",
                  channel:
                    sendChannel,
                  deviceIds:
                    selectedDeviceIds,
                  salePrice:
                    channelSalePrice,
                  listPrice:
                    channelListPrice,
                }),
            }
          );

        const raw =
          await response.text();

        let payload:
          any = null;

        try {
          payload =
            raw
              ? JSON.parse(
                  raw
                )
              : null;
        } catch {
          throw new Error(
            `Merkez kanal ön kontrol API JSON dönmedi. HTTP ${response.status}.`
          );
        }

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "Kanal ön kontrolü başarısız."
          );
        }

        return payload
          .preview as
          ChannelSendPreview;
      },
      [
        selectedDeviceIds,
        sendChannel,
        channelSalePrice,
        channelListPrice,
      ]
    );

  const commitN11Membership =
    useCallback(
      async (
        deviceId: number
      ) => {
        const response =
          await fetch(
            "/api/online/center/devices",
            {
              method:
                "PATCH",
              cache:
                "no-store",
              credentials:
                "same-origin",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  action:
                    "n11_membership_commit",
                  deviceId,
                }),
            }
          );

        const raw =
          await response.text();

        let payload:
          any = null;

        try {
          payload =
            raw
              ? JSON.parse(
                  raw
                )
              : null;
        } catch {
          throw new Error(
            `N11 kanal üyeliği API JSON dönmedi. HTTP ${response.status}.`
          );
        }

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "N11 kanal üyeliği kaydedilemedi."
          );
        }

        return payload.result;
      },
      []
    );

  const sendSelectedToN11 =
    useCallback(
      async () => {
        if (
          n11Sending
        ) {
          return;
        }

        if (
          sendChannel !==
          "N11"
        ) {
          setChannelError(
            "Bu adımda gerçek gönderim yalnızca N11 için aktiftir."
          );
          return;
        }

        setChannelError(
          ""
        );
        setN11SendNotice(
          ""
        );
        setN11SendResults(
          []
        );
        setN11Sending(
          true
        );

        try {
          // GERÇEK GÖNDERİMDEN HEMEN ÖNCE tekrar doğrula.
          const freshPreview =
            await fetchFreshChannelPreview();

          setChannelPreview(
            freshPreview
          );

          if (
            !freshPreview
              .canProceed
          ) {
            throw new Error(
              "Gönderim durduruldu. Ön kontrolde engelli IMEI var."
            );
          }

          const results:
            N11SendResult[] =
            [];

          // Çok kritik:
          // Aynı varyantta N11 havuz çakışması yaşamamak için
          // Promise.all YOK. IMEI'ler TEK TEK / SIRAYLA gönderilir.
          for (
            const item of
              freshPreview.items
          ) {
            if (
              !item.eligible
            ) {
              continue;
            }

            const n11Response =
              await fetch(
                "/api/online/listings",
                {
                  method:
                    "POST",
                  cache:
                    "no-store",
                  credentials:
                    "same-origin",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      imei:
                        item.imei,
                      brand:
                        item.brand,
                      model:
                        item.model,
                      memory:
                        item.memory,
                      color:
                        item.color,
                      grade:
                        item.grade,
                      warranty:
                        item.warranty,
                      salePrice:
                        freshPreview
                          .salePrice,
                      listPrice:
                        freshPreview
                          .listPrice,
                    }),
                }
              );

            const n11Raw =
              await n11Response.text();

            let n11Payload:
              any = null;

            try {
              n11Payload =
                n11Raw
                  ? JSON.parse(
                      n11Raw
                    )
                  : null;
            } catch {
              const failed:
                N11SendResult = {
                  deviceId:
                    item.deviceId,
                  imei:
                    item.imei,
                  success:
                    false,
                  status:
                    "ERROR",
                  message:
                    `N11 API JSON dönmedi. HTTP ${n11Response.status}.`,
                  listingId:
                    null,
                  externalProductId:
                    null,
                };

              results.push(
                failed
              );
              setN11SendResults(
                [...results]
              );

              throw new Error(
                `${item.imei}: ${failed.message}`
              );
            }

            if (
              !n11Response.ok ||
              !n11Payload
                ?.success
            ) {
              const failed:
                N11SendResult = {
                  deviceId:
                    item.deviceId,
                  imei:
                    item.imei,
                  success:
                    false,
                  status:
                    "ERROR",
                  message:
                    n11Payload
                      ?.error ||
                    "N11 ürün gönderimi başarısız.",
                  listingId:
                    Number(
                      n11Payload
                        ?.listingId ||
                        0
                    ) ||
                    null,
                  externalProductId:
                    n11Payload
                      ?.listing
                      ?.external_product_id
                      ? String(
                          n11Payload
                            .listing
                            .external_product_id
                        )
                      : null,
                };

              results.push(
                failed
              );
              setN11SendResults(
                [...results]
              );

              // İlk gerçek N11 hatasında dur.
              // Daha sonraki IMEI'lere geçip riski büyütme.
              throw new Error(
                `${item.imei}: ${failed.message}`
              );
            }

            // N11 accepted/success olduktan SONRA
            // Merkez kanal üyeliğini gerçek listing üzerinden doğrula/yaz.
            let membership:
              any;

            try {
              membership =
                await commitN11Membership(
                  item.deviceId
                );
            } catch (membershipError) {
              const failed:
                N11SendResult = {
                  deviceId:
                    item.deviceId,
                  imei:
                    item.imei,
                  success:
                    false,
                  status:
                    "ERROR",
                  message:
                    `N11 işlemi kabul edildi ancak Merkez kanal kaydı yazılamadı: ${
                      membershipError instanceof
                        Error
                        ? membershipError.message
                        : "Bilinmeyen hata"
                    }`,
                  listingId:
                    Number(
                      n11Payload
                        ?.listing
                        ?.id ||
                        0
                    ) ||
                    null,
                  externalProductId:
                    n11Payload
                      ?.listing
                      ?.external_product_id
                      ? String(
                          n11Payload
                            .listing
                            .external_product_id
                        )
                      : null,
                };

              results.push(
                failed
              );
              setN11SendResults(
                [...results]
              );

              // Marketplace tarafında kabul edilmiş işlem olabilir.
              // Burada yeni IMEI göndermeye devam etmiyoruz.
              throw new Error(
                failed.message
              );
            }

            const membershipStatus =
              String(
                membership
                  ?.membership
                  ?.status ||
                  ""
              ).toUpperCase();

            const successful:
              N11SendResult = {
                deviceId:
                  item.deviceId,
                imei:
                  item.imei,
                success:
                  true,
                status:
                  membershipStatus ===
                  "LISTED"
                    ? "LISTED"
                    : "PENDING_CREATE",
                message:
                  n11Payload
                    ?.message ||
                  (
                    membershipStatus ===
                    "LISTED"
                      ? "N11'e gönderildi."
                      : "N11 işlemi kabul edildi, doğrulama bekleniyor."
                  ),
                listingId:
                  Number(
                    membership
                      ?.listing
                      ?.id ||
                      n11Payload
                        ?.listing
                        ?.id ||
                      0
                  ) ||
                  null,
                externalProductId:
                  membership
                    ?.listing
                    ?.externalProductId
                    ? String(
                        membership
                          .listing
                          .externalProductId
                      )
                    : n11Payload
                        ?.listing
                        ?.external_product_id
                    ? String(
                        n11Payload
                          .listing
                          .external_product_id
                      )
                    : null,
              };

            results.push(
              successful
            );

            setN11SendResults(
              [...results]
            );
          }

          const listed =
            results.filter(
              (item) =>
                item.success &&
                item.status ===
                  "LISTED"
            ).length;

          const pending =
            results.filter(
              (item) =>
                item.success &&
                item.status ===
                  "PENDING_CREATE"
            ).length;

          setN11SendNotice(
            `N11 gönderimi tamamlandı. Gönderildi: ${listed}, N11 doğrulaması bekleyen: ${pending}.`
          );

          await loadCenter(
            true
          );

          setSelectedDeviceIds(
            []
          );
        } catch (error) {
          setChannelError(
            error instanceof
              Error
              ? error.message
              : "N11 gerçek gönderimi tamamlanamadı."
          );

          // Başarılı olanlar varsa Merkez ekranını yine yenile.
          await loadCenter(
            true
          );
        } finally {
          setN11Sending(
            false
          );
        }
      },
      [
        n11Sending,
        sendChannel,
        fetchFreshChannelPreview,
        commitN11Membership,
        loadCenter,
      ]
    );

  const sendSelectedToIkas =
    useCallback(
      async () => {
        if (
          ikasSending
        ) {
          return;
        }

        if (
          sendChannel !==
          "IKAS"
        ) {
          setChannelError(
            "İkas gönderimi için İkas kanalını seç."
          );
          return;
        }

        setChannelError(
          ""
        );
        setIkasSendResults(
          []
        );
        setIkasSendNotice(
          ""
        );
        setIkasSending(
          true
        );

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "PATCH",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    action:
                      "ikas_send",
                    channel:
                      "IKAS",
                    deviceIds:
                      selectedDeviceIds,
                    salePrice:
                      channelSalePrice,
                    listPrice:
                      channelListPrice,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez İkas API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            Array.isArray(
              payload?.results
            )
          ) {
            setIkasSendResults(
              payload.results
            );
          }

          if (
            payload?.preview
          ) {
            setChannelPreview(
              payload.preview
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "İkas gerçek gönderimi başarısız."
            );
          }

          const sent =
            Number(
              payload?.sentImeis ||
                0
            );

          const locationName =
            String(
              payload
                ?.stockLocation
                ?.name ||
                "Ana Depo"
            );

          setIkasSendNotice(
            `${sent} IMEI İkas'a gerçek gönderildi. Stok lokasyonu: ${locationName}.`
          );

          await loadCenter(
            true
          );

          setSelectedDeviceIds(
            []
          );
        } catch (error) {
          setChannelError(
            error instanceof
              Error
              ? error.message
              : "İkas gerçek gönderimi başarısız."
          );

          await loadCenter(
            true
          );
        } finally {
          setIkasSending(
            false
          );
        }
      },
      [
        ikasSending,
        sendChannel,
        channelPreview,
        selectedDeviceIds,
        channelSalePrice,
        channelListPrice,
        loadCenter,
      ]
    );

  const sendSelectedToIdefix =
    useCallback(
      async () => {
        if (
          idefixSending
        ) {
          return;
        }

        if (
          sendChannel !==
          "IDEFIX"
        ) {
          setChannelError(
            "İdefix gönderimi için İdefix kanalını seç."
          );
          return;
        }

        if (
          !channelPreview
            ?.canProceed
        ) {
          setChannelError(
            "Önce başarılı ön kontrol yap."
          );
          return;
        }

        setChannelError(
          ""
        );
        setIdefixSendResults(
          []
        );
        setIdefixSendNotice(
          ""
        );
        setIdefixSending(
          true
        );

        try {
          // 1) Merkez genel kanal kontrolünü kullanıcıya ayrı buton olarak zorlamadan
          // gönderim sırasında otomatik çalıştır.
          const centerPreviewResponse =
            await fetch(
              "/api/online/center/devices",
              {
                method:
                  "PATCH",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    action:
                      "channel_preview",
                    channel:
                      "IDEFIX",
                    deviceIds:
                      selectedDeviceIds,
                    salePrice:
                      channelSalePrice,
                    listPrice:
                      channelListPrice,
                  }),
              }
            );

          const centerPreviewRaw =
            await centerPreviewResponse.text();

          let centerPreviewPayload:
            any = null;

          try {
            centerPreviewPayload =
              centerPreviewRaw
                ? JSON.parse(
                    centerPreviewRaw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez İdefix kontrol API JSON dönmedi. HTTP ${centerPreviewResponse.status}.`
            );
          }

          if (
            !centerPreviewResponse.ok ||
            !centerPreviewPayload
              ?.success
          ) {
            throw new Error(
              centerPreviewPayload
                ?.error ||
                "Merkez İdefix kontrolü başarısız."
            );
          }

          setChannelPreview(
            centerPreviewPayload
              .preview
          );

          if (
            centerPreviewPayload
              ?.preview
              ?.canProceed !==
            true
          ) {
            const errors =
              Array.isArray(
                centerPreviewPayload
                  ?.preview
                  ?.items
              )
                ? centerPreviewPayload
                    .preview
                    .items
                    .flatMap(
                      (
                        row: any
                      ) =>
                        Array.isArray(
                          row
                            ?.errors
                        )
                          ? row
                              .errors
                          : []
                    )
                : [];

            throw new Error(
              errors.length >
              0
                ? errors.join(
                    " | "
                  )
                : "Seçili cihaz İdefix gönderimine uygun değil."
            );
          }

          // 2) İdefix'e özel ürün/eşleşme kontrolü otomatik çalışır.
          const previewResponse =
            await fetch(
              "/api/online/idefix/center-send",
              {
                method:
                  "POST",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mode:
                      "preview",
                    deviceIds:
                      selectedDeviceIds,
                    salePrice:
                      channelSalePrice,
                    listPrice:
                      channelListPrice,
                    catalogBarcode:
                      idefixCatalogBarcode,
                  }),
              }
            );

          const previewRaw =
            await previewResponse.text();

          let idefixPreview:
            any = null;

          try {
            idefixPreview =
              previewRaw
                ? JSON.parse(
                    previewRaw
                  )
                : null;
          } catch {
            throw new Error(
              `İdefix ön kontrol API JSON dönmedi. HTTP ${previewResponse.status}.`
            );
          }

          if (
            !previewResponse.ok ||
            !idefixPreview
              ?.success
          ) {
            const details =
              Array.isArray(
                idefixPreview
                  ?.blockers
              )
                ? idefixPreview
                    .blockers
                    .join(" | ")
                : Array.isArray(
                    idefixPreview
                      ?.errors
                  )
                ? idefixPreview
                    .errors
                    .join(" | ")
                : "";

            throw new Error(
              idefixPreview
                ?.error ||
                details ||
                "İdefix özel ön kontrolü başarısız."
            );
          }

          if (
            idefixPreview
              ?.canCommit !==
            true
          ) {
            const needsBarcode =
              Array.isArray(
                idefixPreview
                  ?.preview
              ) &&
              idefixPreview
                .preview
                .some(
                  (row: any) =>
                    row
                      ?.needsCatalogBarcode ===
                    true
                );

            setIdefixNeedsCatalogBarcode(
              needsBarcode
            );

            if (
              needsBarcode
            ) {
              throw new Error(
                "Bu ürün İdefix'te ilk kez eşleştirilecek. Katalog barkodunu bir kez gir; sonra direkt İdefix'e Gönder'e bas."
              );
            }

            const blockers =
              Array.isArray(
                idefixPreview
                  ?.preview
              )
                ? idefixPreview
                    .preview
                    .flatMap(
                      (
                        row: any
                      ) =>
                        Array.isArray(
                          row
                            ?.blockers
                        )
                          ? row
                              .blockers
                          : []
                    )
                : [];

            throw new Error(
              blockers.length >
              0
                ? blockers.join(
                    " | "
                  )
                : "İdefix gerçek gönderimi için gerekli katalog bilgileri hazır değil."
            );
          }

          // 2) Gerçek Merkez -> İdefix gönderimi.
          const response =
            await fetch(
              "/api/online/idefix/center-send",
              {
                method:
                  "POST",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mode:
                      "commit",
                    deviceIds:
                      selectedDeviceIds,
                    salePrice:
                      channelSalePrice,
                    listPrice:
                      channelListPrice,
                    catalogBarcode:
                      idefixCatalogBarcode,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez İdefix API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            Array.isArray(
              payload?.results
            )
          ) {
            setIdefixSendResults(
              payload.results
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            const details =
              Array.isArray(
                payload
                  ?.blockers
              )
                ? payload
                    .blockers
                    .join(" | ")
                : Array.isArray(
                    payload
                      ?.errors
                  )
                ? payload
                    .errors
                    .join(" | ")
                : "";

            throw new Error(
              payload?.error ||
                details ||
                "İdefix gerçek gönderimi başarısız."
            );
          }

          const results =
            Array.isArray(
              payload?.results
            )
              ? payload.results
              : [];

          const listed =
            results.filter(
              (result: any) =>
                String(
                  result?.state ||
                    ""
                ).toUpperCase() ===
                "LISTED"
            ).length;

          const pending =
            results.filter(
              (result: any) =>
                String(
                  result?.state ||
                    ""
                ).toUpperCase() ===
                "PENDING_CREATE" ||
                result
                  ?.pendingApproval ===
                  true
            ).length;

          const sentImeis =
            Number(
              payload?.sentImeis ||
                results.reduce(
                  (
                    total:
                      number,
                    result:
                      any
                  ) =>
                    total +
                    (
                      Array.isArray(
                        result
                          ?.addedImeis
                      )
                        ? result
                            .addedImeis
                            .length
                        : 0
                    ),
                  0
                )
            );

          setIdefixSendNotice(
            pending > 0
              ? `${sentImeis} IMEI İdefix'e gönderildi. Aktif: ${listed}, İdefix katalog onayı bekleyen: ${pending}.`
              : `${sentImeis} IMEI İdefix'e gerçek gönderildi. Aktif ürün grubu: ${listed}.`
          );

          await loadCenter(
            true
          );

          setSelectedDeviceIds(
            []
          );
        } catch (error) {
          setChannelError(
            error instanceof
              Error
              ? error.message
              : "İdefix gerçek gönderimi başarısız."
          );

          await loadCenter(
            true
          );
        } finally {
          setIdefixSending(
            false
          );
        }
      },
      [
        idefixSending,
        sendChannel,
        selectedDeviceIds,
        channelSalePrice,
        channelListPrice,
        idefixCatalogBarcode,
        loadCenter,
      ]
    );


  const groups =
    useMemo(
      () =>
        Array.isArray(
          center.data?.groups
        )
          ? center.data
              .groups
          : [],
      [center.data]
    );

  const visibleGroups =
    useMemo(() => {
      const q =
        normalize(search);

      return groups
        .map(
          (group: any) => {
            const devices =
              (
                Array.isArray(
                  group?.devices
                )
                  ? group.devices
                  : []
              ).filter(
                (
                  device: any
                ) => {
                  if (
                    onlyAvailable &&
                    device
                      ?.status !==
                      "AVAILABLE"
                  ) {
                    return false;
                  }

                  if (!q) {
                    return true;
                  }

                  const channelText =
                    [
                      device
                        ?.channels
                        ?.N11
                        ?.status,
                      device
                        ?.channels
                        ?.IKAS
                        ?.status,
                      device
                        ?.channels
                        ?.IDEFIX
                        ?.status,
                    ].join(" ");

                  const haystack =
                    [
                      device?.imei,
                      device?.brand,
                      device?.model,
                      device?.memory,
                      device?.color,
                      device?.grade,
                      device?.warranty,
                      device
                        ?.current_branch_code,
                      device?.status,
                      channelText,
                    ]
                      .join(" ")
                      .toLocaleLowerCase(
                        "tr-TR"
                      );

                  return haystack.includes(
                    q
                  );
                }
              );

            const groupText =
              [
                group?.brand,
                group?.model,
                group?.memory,
                group?.color,
                group?.grade,
                group?.warranty,
              ]
                .join(" ")
                .toLocaleLowerCase(
                  "tr-TR"
                );

            if (
              q &&
              devices.length ===
                0 &&
              !groupText.includes(
                q
              )
            ) {
              return null;
            }

            const finalDevices =
              q &&
              groupText.includes(
                q
              )
                ? (
                    Array.isArray(
                      group?.devices
                    )
                      ? group.devices
                      : []
                  ).filter(
                    (
                      device: any
                    ) =>
                      !onlyAvailable ||
                      device
                        ?.status ===
                        "AVAILABLE"
                  )
                : devices;

            if (
              finalDevices
                .length === 0
            ) {
              return null;
            }

            const sentCount = (
              channel: ChannelCode
            ) =>
              finalDevices.filter(
                (
                  device: any
                ) =>
                  [
                    "LISTED",
                    "RESERVED",
                    "SOLD",
                    "PENDING_CREATE",
                  ].includes(
                    String(
                      device
                        ?.channels?.[
                        channel
                      ]?.status ||
                        ""
                    ).toUpperCase()
                  )
              ).length;

            return {
              ...group,
              devices:
                finalDevices,
              visibleTotal:
                finalDevices.length,
              visibleChannelSummary:
                {
                  N11:
                    sentCount(
                      "N11"
                    ),
                  IKAS:
                    sentCount(
                      "IKAS"
                    ),
                  IDEFIX:
                    sentCount(
                      "IDEFIX"
                    ),
                },
            };
          }
        )
        .filter(Boolean);
    }, [
      groups,
      search,
      onlyAvailable,
    ]);

  const summary =
    center.data?.summary ||
    {};

  const cards = [
    {
      label:
        "Fiziksel Stok",
      value:
        summary
          ?.activePhysicalStock ??
        0,
      detail:
        "Merkez aktif IMEI",
    },
    {
      label:
        "Gönderilebilir",
      value:
        summary
          ?.availableDevices ??
        0,
      detail:
        "AVAILABLE cihaz",
    },
    {
      label: "N11",
      value:
        summary?.n11 ?? 0,
      detail:
        "Kanala bağlı IMEI",
    },
    {
      label: "İkas",
      value:
        summary?.ikas ?? 0,
      detail:
        "Gönderildi / hazırlanıyor",
    },
    {
      label: "İdefix",
      value:
        summary?.idefix ??
        0,
      detail:
        "Kanala bağlı IMEI",
    },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/70">
                Entegrasyonlar / Merkez
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Merkezi IMEI Stok
                </h2>

                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[8px] font-black uppercase text-cyan-100">
                  ADIM 1
                </span>
              </div>

              <p className="mt-2 max-w-3xl text-[10px] font-semibold leading-5 text-slate-300">
                Fiziksel cihaz tek merkezde tutulur. Her IMEI'nin N11, İkas ve İdefix kanal durumu ayrı izlenir.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                  Son Okuma
                </div>
                <div className="mt-0.5 text-[9px] font-black text-white">
                  {formatDateTime(
                    center.data
                      ?.checkedAt
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAddError("");
                  setAddSuccess("");
                  setAddOpen(true);
                }}
                className="h-10 rounded-xl border border-white/15 bg-white px-4 text-[8px] font-black uppercase tracking-wide text-slate-950 transition hover:bg-slate-100"
              >
                + Cihaz Ekle
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkError("");
                  setBulkSuccess("");
                  setBulkPreview(
                    null
                  );
                  setBulkOpen(true);
                }}
                className="h-10 rounded-xl border border-white/15 bg-white/10 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-white/15"
              >
                + Toplu Cihaz Ekle
              </button>

              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  const file =
                    event.target
                      .files?.[0];

                  event.currentTarget.value =
                    "";

                  if (file) {
                    void handleExcelFile(
                      file
                    );
                  }
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setExcelError("");
                  setExcelSuccess("");
                  setExcelPreview(
                    null
                  );
                  excelInputRef.current?.click();
                }}
                className="h-10 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 text-[8px] font-black uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-400/15"
              >
                Excel ile Yükle
              </button>

              <button
                type="button"
                onClick={() => {
                  void loadCenter();
                }}
                disabled={
                  center.loading
                }
                className="h-10 rounded-xl bg-cyan-500 px-4 text-[8px] font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-50"
              >
                {center.loading
                  ? "Yenileniyor..."
                  : "Merkezi Yenile"}
              </button>
            </div>
          </div>
        </div>

        {center.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[9px] font-black text-rose-700 sm:px-6">
            {center.error}
          </div>
        )}

        {!center.data
          ?.channelMembershipTableReady &&
          center.success && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-[8px] font-bold text-amber-800 sm:px-6">
              Kanal IMEI üyelik tablosu bulunamadı. N11 durumları eski availableImeis kayıtlarından okunuyor; İkas/İdefix üyelikleri için ADIM 8 migration gerekir.
            </div>
          )}

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5 sm:p-6">
          {cards.map(
            (
              card,
              index
            ) => (
              <div
                key={
                  card.label
                }
                className={`rounded-2xl border p-5 ${
                  index === 0
                    ? "border-cyan-200 bg-cyan-50/60"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {card.label}
                </div>

                <div className="mt-2 text-2xl font-black text-slate-950">
                  {card.value}
                </div>

                <div className="mt-1 text-[8px] font-semibold text-slate-400">
                  {card.detail}
                </div>
              </div>
            )
          )}
        </div>

        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setOnlyAvailable(
                    true
                  )
                }
                className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide ${
                  onlyAvailable
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                Sadece AVAILABLE
              </button>

              <button
                type="button"
                onClick={() =>
                  setOnlyAvailable(
                    false
                  )
                }
                className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide ${
                  !onlyAvailable
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                Tüm Durumlar
              </button>

              <span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-slate-500 ring-1 ring-slate-200">
                Ürün Grubu:{" "}
                {
                  visibleGroups.length
                }
              </span>
            </div>

            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="IMEI, ürün, renk, mağaza ara..."
                className="h-10 w-[320px] max-w-[75vw] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[9px] font-semibold text-slate-700 outline-none transition focus:border-cyan-400"
              />
            </div>
          </div>

          {selectedDeviceIds.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-600 px-3 py-1.5 text-[8px] font-black uppercase text-white">
                  {selectedDeviceIds.length} IMEI Seçildi
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeviceIds(
                      []
                    );
                    setChannelPreview(
                      null
                    );
                  }}
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-[8px] font-black uppercase text-blue-700"
                >
                  Seçimi Temizle
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openChannelSend(
                      "N11"
                    )
                  }
                  className="h-10 rounded-xl bg-slate-950 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-slate-800"
                >
                  N11'e Hazırla
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openChannelSend(
                      "IKAS"
                    )
                  }
                  className="h-10 rounded-xl bg-blue-600 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-blue-700"
                >
                  İkas'a Hazırla
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openChannelSend(
                      "IDEFIX"
                    )
                  }
                  className="h-10 rounded-xl border border-violet-200 bg-violet-50 px-4 text-[8px] font-black uppercase tracking-wide text-violet-700 transition hover:bg-violet-100"
                >
                  İdefix'e Hazırla
                </button>
              </div>
            </div>
          )}

          {center.loading &&
          !center.success ? (
            <div className="px-6 py-20 text-center">
              <div className="text-[11px] font-black text-slate-700">
                Merkezi IMEI stoğu okunuyor...
              </div>

              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                stock_devices ve kanal üyelikleri birleştiriliyor.
              </div>
            </div>
          ) : visibleGroups.length ===
            0 ? (
            <div className="px-6 py-20 text-center">
              <div className="text-[11px] font-black text-slate-700">
                Cihaz bulunamadı
              </div>

              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                Filtreyi veya aramayı değiştir.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleGroups.map(
                (
                  group: any
                ) => {
                  const open =
                    expandedKey ===
                    group.key;

                  return (
                    <div
                      key={
                        group.key
                      }
                      className="px-5 py-4 sm:px-6"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedKey(
                            open
                              ? null
                              : group.key
                          )
                        }
                        className="grid w-full gap-4 text-left xl:grid-cols-[minmax(280px,1.5fr)_85px_115px_115px_115px_34px] xl:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-black text-slate-900">
                            {group.brand}{" "}
                            {group.model}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-600">
                              {group.memory}
                            </span>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-600">
                              {group.color}
                            </span>

                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[7px] font-black text-violet-700">
                              Grade {group.grade}
                            </span>

                            <span className="rounded-full bg-blue-100 px-2 py-1 text-[7px] font-black text-blue-700">
                              {group.warranty}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[7px] font-black uppercase text-slate-400">
                            IMEI
                          </div>
                          <div className="mt-1 text-[13px] font-black text-slate-900">
                            {
                              group.visibleTotal
                            }
                          </div>
                        </div>

                        {(
                          [
                            "N11",
                            "IKAS",
                            "IDEFIX",
                          ] as ChannelCode[]
                        ).map(
                          (
                            channel
                          ) => (
                            <div
                              key={
                                channel
                              }
                            >
                              <div className="text-[7px] font-black uppercase text-slate-400">
                                {
                                  channel ===
                                  "IKAS"
                                    ? "İkas"
                                    : channel ===
                                      "IDEFIX"
                                    ? "İdefix"
                                    : "N11"
                                }
                              </div>

                              <div className="mt-1 text-[11px] font-black text-slate-800">
                                {
                                  group
                                    .visibleChannelSummary?.[
                                    channel
                                  ] ??
                                  0
                                }{" "}
                                /{" "}
                                {
                                  group.visibleTotal
                                }
                              </div>
                            </div>
                          )
                        )}

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                          <svg
                            className={`h-3.5 w-3.5 transition ${
                              open
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="m19 9-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {open && (
                        <>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="text-[8px] font-bold text-slate-500">
                              Kanal gönderimi için yalnızca AVAILABLE IMEI'ler seçilebilir.
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const ids =
                                    (
                                      Array.isArray(
                                        group?.devices
                                      )
                                        ? group.devices
                                        : []
                                    )
                                      .filter(
                                        (
                                          device: any
                                        ) =>
                                          device?.status ===
                                          "AVAILABLE"
                                      )
                                      .map(
                                        (
                                          device: any
                                        ) =>
                                          Number(
                                            device.id
                                          )
                                      );

                                  setSelectedDeviceIds(
                                    (current) =>
                                      Array.from(
                                        new Set([
                                          ...current,
                                          ...ids,
                                        ])
                                      )
                                  );

                                  setChannelPreview(
                                    null
                                  );
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[7px] font-black uppercase text-slate-600"
                              >
                                AVAILABLE Tümünü Seç
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const groupIds =
                                    new Set(
                                      (
                                        Array.isArray(
                                          group?.devices
                                        )
                                          ? group.devices
                                          : []
                                      ).map(
                                        (
                                          device: any
                                        ) =>
                                          Number(
                                            device.id
                                          )
                                      )
                                    );

                                  setSelectedDeviceIds(
                                    (current) =>
                                      current.filter(
                                        (id) =>
                                          !groupIds.has(
                                            id
                                          )
                                      )
                                  );

                                  setChannelPreview(
                                    null
                                  );
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[7px] font-black uppercase text-slate-500"
                              >
                                Grup Seçimini Kaldır
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                          <div className="min-w-[1040px]">
                            <div className="grid grid-cols-[42px_170px_120px_minmax(170px,1fr)_120px_120px_120px_120px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[7px] font-black uppercase tracking-wide text-slate-400">
                              <div>
                                Seç
                              </div>
                              <div>
                                IMEI
                              </div>
                              <div>
                                Mağaza
                              </div>
                              <div>
                                Cihaz
                              </div>
                              <div>
                                Durum
                              </div>
                              <div>
                                N11
                              </div>
                              <div>
                                İkas
                              </div>
                              <div>
                                İdefix
                              </div>
                            </div>

                            {(
                              Array.isArray(
                                group
                                  ?.devices
                              )
                                ? group.devices
                                : []
                            ).map(
                              (
                                device: any
                              ) => {
                                const deviceMeta =
                                  deviceStatusMeta(
                                    device
                                      ?.status
                                  );

                                return (
                                  <div
                                    key={
                                      device.id
                                    }
                                    className="grid grid-cols-[42px_170px_120px_minmax(170px,1fr)_120px_120px_120px_120px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[8px] last:border-0"
                                  >
                                    <div>
                                      <input
                                        type="checkbox"
                                        checked={
                                          selectedDeviceIds.includes(
                                            Number(
                                              device.id
                                            )
                                          )
                                        }
                                        disabled={
                                          device?.status !==
                                          "AVAILABLE"
                                        }
                                        onChange={() =>
                                          toggleDeviceSelection(
                                            Number(
                                              device.id
                                            )
                                          )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                                        title={
                                          device?.status ===
                                          "AVAILABLE"
                                            ? "Kanal gönderimi için seç"
                                            : "Yalnızca AVAILABLE cihaz seçilebilir"
                                        }
                                      />
                                    </div>

                                    <div className="font-black text-slate-900">
                                      {
                                        device.imei
                                      }
                                    </div>

                                    <div className="font-bold text-slate-500">
                                      {device
                                        ?.current_branch_code ||
                                        "-"}
                                    </div>

                                    <div>
                                      <div className="font-black text-slate-800">
                                        {device
                                          ?.brand ||
                                          "-"}{" "}
                                        {device
                                          ?.model ||
                                          "-"}
                                      </div>

                                      <div className="mt-1 text-[7px] font-bold text-slate-400">
                                        {device
                                          ?.memory ||
                                          "-"}{" "}
                                        ·{" "}
                                        {device
                                          ?.color ||
                                          "-"}{" "}
                                        · Grade{" "}
                                        {device
                                          ?.grade ||
                                          "-"}
                                      </div>
                                    </div>

                                    <div>
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-[7px] font-black uppercase ${deviceMeta.className}`}
                                      >
                                        {
                                          deviceMeta.label
                                        }
                                      </span>
                                    </div>

                                    <ChannelBadge
                                      channel="N11"
                                      status={
                                        device
                                          ?.channels
                                          ?.N11
                                          ?.status
                                      }
                                    />

                                    <ChannelBadge
                                      channel="IKAS"
                                      status={
                                        device
                                          ?.channels
                                          ?.IKAS
                                          ?.status
                                      }
                                    />

                                    <ChannelBadge
                                      channel="IDEFIX"
                                      status={
                                        device
                                          ?.channels
                                          ?.IDEFIX
                                          ?.status
                                      }
                                    />
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[8px] font-bold text-slate-400 sm:px-6">
          MERKEZ · N11 + İkas + İdefix gerçek gönderim aktif
        </div>
      </div>

      {channelOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !channelLoading
            ) {
              setChannelOpen(false);
            }
          }}
        >
          <div className="my-4 w-full max-w-[980px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Merkez · Kanal Gönderim Merkezi
                </div>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  {channelLabel(
                    sendChannel
                  )} Ön Kontrol
                </h3>

                <p className="mt-1 text-[9px] font-semibold leading-5 text-slate-500">
                  Seçili IMEI'ler önce kontrol edilir. N11, İkas ve İdefix kanallarında başarılı ön kontrolden sonra gerçek gönderim yapılabilir.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  channelLoading ||
                  n11Sending ||
                  ikasSending ||
                  idefixSending
                }
                onClick={() =>
                  setChannelOpen(
                    false
                  )
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-7">
              {channelError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-black text-rose-700">
                  {channelError}
                </div>
              )}

              <div>
                <div className="mb-2 text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Kanal
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      "N11",
                      "IKAS",
                      "IDEFIX",
                    ] as ChannelCode[]
                  ).map(
                    (channel) => (
                      <button
                        key={
                          channel
                        }
                        type="button"
                        onClick={() => {
                          setSendChannel(
                            channel
                          );
                          setChannelPreview(
                            null
                          );
                          setChannelError(
                            ""
                          );
                          setN11SendResults(
                            []
                          );
                          setN11SendNotice(
                            ""
                          );
                          setIkasSendResults(
                            []
                          );
                          setIkasSendNotice(
                            ""
                          );
                          setIdefixSendResults(
                            []
                          );
                          setIdefixSendNotice(
                            ""
                          );
                          setIdefixCatalogBarcode(
                            ""
                          );
                          setIdefixNeedsCatalogBarcode(
                            false
                          );
                        }}
                        className={`h-12 rounded-xl border text-[9px] font-black uppercase transition ${
                          sendChannel ===
                          channel
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {channelLabel(
                          channel
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[7px] font-black uppercase text-slate-400">
                    Seçili IMEI
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-950">
                    {
                      selectedDeviceIds.length
                    }
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Satış Fiyatı
                  </label>
                  <input
                    value={
                      channelSalePrice
                    }
                    onChange={(
                      event
                    ) => {
                      setChannelSalePrice(
                        event.target
                          .value
                      );
                      setChannelPreview(
                        null
                      );
                    }}
                    inputMode="decimal"
                    placeholder="22.999"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Liste Fiyatı
                  </label>
                  <input
                    value={
                      channelListPrice
                    }
                    onChange={(
                      event
                    ) => {
                      setChannelListPrice(
                        event.target
                          .value
                      );
                      setChannelPreview(
                        null
                      );
                    }}
                    inputMode="decimal"
                    placeholder="24.999"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </div>

              {sendChannel ===
                "IDEFIX" &&
                (
                  idefixNeedsCatalogBarcode ||
                  Boolean(
                    idefixCatalogBarcode
                  )
                ) && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-violet-700">
                    İdefix Katalog Barkodu · Sadece İlk Eşleştirme
                  </label>
                  <input
                    value={
                      idefixCatalogBarcode
                    }
                    onChange={(
                      event
                    ) => {
                      setIdefixCatalogBarcode(
                        event.target
                          .value
                          .trim()
                      );
                      setChannelPreview(
                        null
                      );
                      setChannelError(
                        ""
                      );
                    }}
                    inputMode="text"
                    placeholder="Katalogda mevcut üründe global barkod"
                    className="h-12 w-full rounded-xl border border-violet-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                  />
                  <div className="mt-2 text-[7px] font-bold leading-4 text-violet-700">
                    Bu alan yalnızca ürün CNETMOBİL İdefix havuzunda ilk kez açılırken görünür. Bir kez doğru katalog barkoduyla eşleşince sistem kaydeder; sonraki aynı model/hafıza/renk/kalite cihazlarda N11 gibi otomatik kullanır.
                  </div>
                </div>
              )}

              {channelPreview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50">
                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Toplam
                      </div>
                      <div className="mt-1 text-xl font-black text-slate-900">
                        {
                          channelPreview.total
                        }
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-emerald-600">
                        Gönderilebilir
                      </div>
                      <div className="mt-1 text-xl font-black text-emerald-700">
                        {
                          channelPreview.eligible
                        }
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-rose-600">
                        Engelli
                      </div>
                      <div className="mt-1 text-xl font-black text-rose-700">
                        {
                          channelPreview.blocked
                        }
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-[8px] font-black">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        {channelLabel(
                          channelPreview.channel
                        )}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                        Satış:{" "}
                        {formatMoney(
                          channelPreview.salePrice
                        )}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                        Liste:{" "}
                        {formatMoney(
                          channelPreview.listPrice
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {channelPreview.items.map(
                      (item) => (
                        <div
                          key={
                            item.deviceId
                          }
                          className={`grid gap-2 px-4 py-3 sm:grid-cols-[165px_minmax(180px,1fr)_105px] sm:items-center ${
                            item.eligible
                              ? "bg-emerald-50/35"
                              : "bg-rose-50/45"
                          }`}
                        >
                          <div>
                            <div className="font-mono text-[8px] font-black text-slate-900">
                              {
                                item.imei
                              }
                            </div>
                            <div className="mt-1 text-[7px] font-bold text-slate-400">
                              {
                                item.status
                              }
                            </div>
                          </div>

                          <div>
                            <div className="text-[8px] font-black text-slate-800">
                              {item.brand}{" "}
                              {item.model} ·{" "}
                              {item.memory} ·{" "}
                              {item.color} · Grade{" "}
                              {item.grade}
                            </div>

                            {!item.eligible && (
                              <div className="mt-1 space-y-1">
                                {item.errors.map(
                                  (
                                    error,
                                    index
                                  ) => (
                                    <div
                                      key={
                                        index
                                      }
                                      className="text-[7px] font-bold text-rose-700"
                                    >
                                      •{" "}
                                      {
                                        error
                                      }
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[7px] font-black uppercase ${
                                item.eligible
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {item.eligible
                                ? "Hazır"
                                : "Engelli"}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {channelPreview?.canProceed && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-[9px] font-black text-emerald-800">
                    ✓ Tüm IMEI'ler {channelLabel(
                      sendChannel
                    )} gönderimine hazır.
                  </div>

                  <div className="mt-1 text-[7px] font-semibold leading-4 text-emerald-700">
                    {sendChannel ===
                    "N11"
                      ? "N11 için gerçek gönderim aktif. Gönderim öncesi kontrol tekrar yapılır ve mevcut çalışan N11 motoru kullanılır."
                      : sendChannel ===
                        "IKAS"
                      ? "İkas için gerçek gönderim aktif. Ürün/varyant canlı İkas'ta bulunur veya oluşturulur, fiyat ve Ana Depo stoğu yazılır, sonra tekrar okunarak doğrulanır."
                      : "İdefix için gerçek gönderim aktif. Satıcı havuzundaki ürün doğrudan güncellenir; katalog barkodu girilen mevcut katalog ürünü fast-listing ile hızlıca açılır."}
                  </div>
                </div>
              )}

              {n11SendNotice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-[9px] font-black text-emerald-800">
                    ✓ {n11SendNotice}
                  </div>
                </div>
              )}

              {ikasSendNotice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <div className="text-[9px] font-black text-emerald-800">
                    ✓ {ikasSendNotice}
                  </div>
                </div>
              )}

              {idefixSendNotice && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
                  <div className="text-[9px] font-black text-violet-800">
                    ✓ {idefixSendNotice}
                  </div>
                </div>
              )}

              {idefixSendResults.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-600">
                      Gerçek İdefix Gönderim Sonucu
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {idefixSendResults.map(
                      (
                        result,
                        index
                      ) => {
                        const pending =
                          String(
                            result.state ||
                              ""
                          ).toUpperCase() ===
                            "PENDING_CREATE" ||
                          result.pendingApproval ===
                            true;

                        return (
                          <div
                            key={`${result.barcode}-${index}`}
                            className={
                              pending
                                ? "bg-amber-50/45 px-4 py-3"
                                : "bg-emerald-50/35 px-4 py-3"
                            }
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="text-[9px] font-black text-slate-900">
                                  {result.title}
                                </div>

                                <div className="mt-1 text-[7px] font-bold text-slate-500">
                                  {result.color} · Barkod {result.barcode || "-"}
                                </div>

                                <div className="mt-1 text-[7px] font-bold text-slate-500">
                                  IMEI: {result.addedImeis.join(", ")}
                                </div>
                              </div>

                              <span
                                className={`inline-flex self-start rounded-full px-2.5 py-1 text-[7px] font-black uppercase ${
                                  pending
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {pending
                                  ? "İdefix Onayında"
                                  : "Gönderildi"}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-4">
                              <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                                <div className="text-[6px] font-black uppercase text-slate-400">
                                  İşlem
                                </div>
                                <div className="mt-1 text-[7px] font-black text-slate-700">
                                  {result.action ===
                                  "FAST_LISTING"
                                    ? "Hızlı Katalog"
                                    : result.action ===
                                      "CREATE_PRODUCT"
                                    ? "Yeni Ürün"
                                    : "Mevcut Ürün"}
                                </div>
                              </div>

                              <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                                <div className="text-[6px] font-black uppercase text-slate-400">
                                  Stok
                                </div>
                                <div className="mt-1 text-[7px] font-black text-slate-700">
                                  {result.beforeStock} → {result.afterStock}
                                </div>
                              </div>

                              <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                                <div className="text-[6px] font-black uppercase text-slate-400">
                                  Durum
                                </div>
                                <div
                                  className={`mt-1 text-[7px] font-black ${
                                    pending
                                      ? "text-amber-700"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {pending
                                    ? "Katalog Onayı"
                                    : "Aktif"}
                                </div>
                              </div>

                              <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                                <div className="text-[6px] font-black uppercase text-slate-400">
                                  Listing
                                </div>
                                <div className="mt-1 text-[7px] font-black text-slate-700">
                                  #{result.listingId || "-"}
                                </div>
                              </div>
                            </div>

                            {result.message && (
                              <div className="mt-2 text-[7px] font-bold text-slate-500">
                                {result.message}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {ikasSendResults.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-600">
                      Gerçek İkas Gönderim Sonucu
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {ikasSendResults.map(
                      (
                        result,
                        index
                      ) => (
                        <div
                          key={`${result.variantId}-${index}`}
                          className="bg-emerald-50/35 px-4 py-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-[9px] font-black text-slate-900">
                                {result.title}
                              </div>

                              <div className="mt-1 text-[7px] font-bold text-slate-500">
                                {result.color} · SKU {result.sku || "-"}
                              </div>

                              <div className="mt-1 text-[7px] font-bold text-slate-500">
                                IMEI: {result.addedImeis.join(", ")}
                              </div>
                            </div>

                            <span className="inline-flex self-start rounded-full bg-emerald-100 px-2.5 py-1 text-[7px] font-black uppercase text-emerald-700">
                              Gönderildi
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-5">
                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                              <div className="text-[6px] font-black uppercase text-slate-400">
                                İşlem
                              </div>
                              <div className="mt-1 text-[7px] font-black text-slate-700">
                                {result.action === "CREATE_PRODUCT"
                                  ? "Yeni Ürün"
                                  : result.action === "ADD_VARIANT"
                                  ? "Yeni Varyant"
                                  : "Mevcut Varyant"}
                              </div>
                            </div>

                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                              <div className="text-[6px] font-black uppercase text-slate-400">
                                Stok
                              </div>
                              <div className="mt-1 text-[7px] font-black text-slate-700">
                                {result.beforeStock} → {result.afterStock}
                              </div>
                            </div>

                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                              <div className="text-[6px] font-black uppercase text-slate-400">
                                Satış
                              </div>
                              <div className="mt-1 text-[7px] font-black text-slate-700">
                                {formatMoney(result.salePrice)}
                              </div>
                            </div>

                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                              <div className="text-[6px] font-black uppercase text-slate-400">
                                Liste
                              </div>
                              <div className="mt-1 text-[7px] font-black text-slate-700">
                                {formatMoney(result.listPrice)}
                              </div>
                            </div>

                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                              <div className="text-[6px] font-black uppercase text-slate-400">
                                Satış Kanalı
                              </div>
                              <div className="mt-1 text-[7px] font-black text-emerald-700">
                                {result.salesChannelVisibility?.status === "VISIBLE"
                                  ? `Açık · ${result.salesChannelVisibility?.name || "İkas"}`
                                  : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {n11SendResults.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-600">
                      Gerçek N11 Gönderim Sonucu
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {n11SendResults.map(
                      (result) => (
                        <div
                          key={
                            result.deviceId
                          }
                          className={`grid gap-2 px-4 py-3 sm:grid-cols-[165px_115px_1fr] sm:items-center ${
                            result.success
                              ? result.status ===
                                "LISTED"
                                ? "bg-emerald-50/40"
                                : "bg-amber-50/45"
                              : "bg-rose-50/50"
                          }`}
                        >
                          <div className="font-mono text-[8px] font-black text-slate-900">
                            {
                              result.imei
                            }
                          </div>

                          <div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[7px] font-black uppercase ${
                                result.success
                                  ? result.status ===
                                    "LISTED"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {result.success
                                ? result.status ===
                                  "LISTED"
                                  ? "Gönderildi"
                                  : "N11 Bekleniyor"
                                : "Hata"}
                            </span>
                          </div>

                          <div className="text-[8px] font-bold text-slate-600">
                            {
                              result.message
                            }
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-[8px] font-black text-amber-800">
                  Tekrar gönderme koruması aktif
                </div>
                <div className="mt-1 text-[7px] font-semibold leading-4 text-amber-700">
                  Aynı IMEI bu kanalda online_channel_devices, bağlı listing veya eski N11 IMEI havuzunda bulunursa ön kontrol engeller.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <button
                type="button"
                disabled={
                  channelLoading ||
                  n11Sending ||
                  ikasSending ||
                  idefixSending
                }
                onClick={() =>
                  setChannelOpen(
                    false
                  )
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[8px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Kapat
              </button>

              {sendChannel !==
                "IDEFIX" && (
                <button
                  type="button"
                  disabled={
                    channelLoading ||
                    selectedDeviceIds.length ===
                      0
                  }
                  onClick={() => {
                    void runChannelPreview();
                  }}
                  className="h-11 rounded-xl bg-blue-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
                >
                  {channelLoading
                    ? "Kontrol Ediliyor..."
                    : "Ön Kontrol Yap"}
                </button>
              )}


              {sendChannel ===
                "N11" && (
                <button
                  type="button"
                  disabled={
                    channelLoading ||
                    n11Sending ||
                    !channelPreview
                      ?.canProceed
                  }
                  onClick={() => {
                    void sendSelectedToN11();
                  }}
                  className="h-11 rounded-xl bg-emerald-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {n11Sending
                    ? "N11'e Gönderiliyor..."
                    : `N11'e Gerçekten Gönder (${selectedDeviceIds.length})`}
                </button>
              )}


              {sendChannel ===
                "IKAS" && (
                <button
                  type="button"
                  disabled={
                    channelLoading ||
                    ikasSending ||
                    !channelPreview
                      ?.canProceed
                  }
                  onClick={() => {
                    void sendSelectedToIkas();
                  }}
                  className="h-11 rounded-xl bg-emerald-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {ikasSending
                    ? "İkas'a Gönderiliyor..."
                    : `İkas'a Gerçekten Gönder (${selectedDeviceIds.length})`}
                </button>
              )}


              {sendChannel ===
                "IDEFIX" && (
                <button
                  type="button"
                  disabled={
                    channelLoading ||
                    idefixSending ||
                    selectedDeviceIds.length ===
                      0
                  }
                  onClick={() => {
                    void sendSelectedToIdefix();
                  }}
                  className="h-11 rounded-xl bg-violet-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {idefixSending
                    ? "İdefix'e Gönderiliyor..."
                    : `İdefix'e Gönder (${selectedDeviceIds.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {excelOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !excelLoading
            ) {
              setExcelOpen(false);
            }
          }}
        >
          <div className="my-4 w-full max-w-[1100px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-600">
                  Online · Merkez
                </div>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Excel ile Cihaz Yükle
                </h3>

                <p className="mt-1 text-[9px] font-semibold leading-5 text-slate-500">
                  Aynı Excel içinde farklı marka, model, hafıza, renk ve grade cihazlar olabilir. Önce tüm satırlar kontrol edilir.
                </p>
              </div>

              <button
                type="button"
                disabled={excelLoading}
                onClick={() =>
                  setExcelOpen(false)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-7">
              {excelError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-black text-rose-700">
                  {excelError}
                </div>
              )}

              {excelSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-black text-emerald-700">
                  ✓ {excelSuccess}
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                    Seçili Dosya
                  </div>
                  <div className="mt-1 text-[10px] font-black text-slate-800">
                    {excelFileName || "Dosya seçilmedi"}
                  </div>
                  <div className="mt-1 text-[8px] font-semibold text-slate-500">
                    Okunan cihaz satırı: {excelRows.length}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={excelLoading}
                  onClick={() =>
                    excelInputRef.current?.click()
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[8px] font-black uppercase text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Başka Excel Seç
                </button>
              </div>

              {excelRows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <div className="min-w-[930px]">
                      <div className="grid grid-cols-[55px_155px_105px_170px_95px_100px_70px_90px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[7px] font-black uppercase tracking-wide text-slate-400">
                        <div>Satır</div>
                        <div>IMEI</div>
                        <div>Marka</div>
                        <div>Model</div>
                        <div>Hafıza</div>
                        <div>Renk</div>
                        <div>Grade</div>
                        <div>Garanti</div>
                      </div>

                      {excelRows
                        .slice(
                          0,
                          12
                        )
                        .map(
                          (row) => (
                            <div
                              key={`${row.rowNumber}-${row.imei}`}
                              className="grid grid-cols-[55px_155px_105px_170px_95px_100px_70px_90px] gap-2 border-b border-slate-100 px-3 py-2.5 text-[8px] last:border-0"
                            >
                              <div className="font-black text-slate-400">
                                {row.rowNumber}
                              </div>
                              <div className="font-mono font-black text-slate-900">
                                {row.imei || "-"}
                              </div>
                              <div className="font-bold text-slate-700">
                                {row.brand || "-"}
                              </div>
                              <div className="font-bold text-slate-700">
                                {row.model || "-"}
                              </div>
                              <div className="font-bold text-slate-700">
                                {row.memory || "-"}
                              </div>
                              <div className="font-bold text-slate-700">
                                {row.color || "-"}
                              </div>
                              <div className="font-black text-slate-700">
                                {row.grade || "-"}
                              </div>
                              <div className="font-bold text-slate-700">
                                {row.warranty || "-"}
                              </div>
                            </div>
                          )
                        )}

                      {excelRows.length > 12 && (
                        <div className="bg-slate-50 px-4 py-3 text-center text-[8px] font-black text-slate-500">
                          + {excelRows.length - 12} satır daha
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {excelPreview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50">
                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Toplam
                      </div>
                      <div className="mt-1 text-xl font-black text-slate-900">
                        {excelPreview.total}
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-emerald-600">
                        Geçerli
                      </div>
                      <div className="mt-1 text-xl font-black text-emerald-700">
                        {excelPreview.valid}
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-rose-600">
                        Hatalı
                      </div>
                      <div className="mt-1 text-xl font-black text-rose-700">
                        {excelPreview.invalid}
                      </div>
                    </div>
                  </div>

                  {excelPreview.errors.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto divide-y divide-rose-100">
                      {excelPreview.errors.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={`${item.rowNumber}-${item.imei}-${index}`}
                            className="grid gap-1 bg-rose-50/60 px-4 py-3 sm:grid-cols-[70px_170px_1fr]"
                          >
                            <div className="text-[8px] font-black text-rose-500">
                              Satır {item.rowNumber || "-"}
                            </div>
                            <div className="font-mono text-[8px] font-black text-rose-800">
                              {item.imei || "-"}
                            </div>
                            <div className="text-[8px] font-bold text-rose-700">
                              {item.reason}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 px-4 py-3 text-[8px] font-black text-emerald-700">
                      ✓ Excel'deki tüm cihazlar temiz. Kayıt yapılabilir.
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[8px] font-black text-slate-700">
                  Zorunlu Excel kolonları
                </div>
                <div className="mt-1 text-[7px] font-semibold leading-4 text-slate-500">
                  IMEI · Marka · Model · Hafıza · Renk · Grade · Garanti. Durum, mağaza, pil, fiyat, değişen parça ve kutu/fatura bu dosyada kullanılmaz.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <button
                type="button"
                disabled={excelLoading}
                onClick={() =>
                  setExcelOpen(false)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[8px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={
                  excelLoading ||
                  excelRows.length ===
                    0
                }
                onClick={() => {
                  void runExcelDevice(
                    "preview"
                  );
                }}
                className="h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-6 text-[8px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"
              >
                {excelLoading
                  ? "Kontrol Ediliyor..."
                  : "Excel'i Kontrol Et"}
              </button>

              <button
                type="button"
                disabled={
                  excelLoading ||
                  !excelPreview?.canCommit
                }
                onClick={() => {
                  void runExcelDevice(
                    "commit"
                  );
                }}
                className="h-11 rounded-xl bg-emerald-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {excelLoading
                  ? "Kaydediliyor..."
                  : excelPreview?.canCommit
                  ? `${excelPreview.total} Cihazı Excel'den Ekle`
                  : "Önce Kontrol Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div
          className="fixed inset-0 z-[125] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !bulkLoading
            ) {
              setBulkOpen(false);
            }
          }}
        >
          <div className="my-4 w-full max-w-[1040px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Online · Merkez
                </div>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Toplu Cihaz Ekle
                </h3>

                <p className="mt-1 text-[9px] font-semibold leading-5 text-slate-500">
                  Ortak ürün bilgilerini bir kez gir, IMEI'leri topluca yapıştır. Önce kontrol edilir; hata varsa hiçbir cihaz kaydedilmez.
                </p>
              </div>

              <button
                type="button"
                disabled={bulkLoading}
                onClick={() =>
                  setBulkOpen(false)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-7">
              {bulkError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-black text-rose-700">
                  {bulkError}
                </div>
              )}

              {bulkSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-black text-emerald-700">
                  ✓ {bulkSuccess}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Marka
                  </label>
                  <input
                    value={bulkForm.brand}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        brand: event.target.value,
                      }));
                    }}
                    placeholder="Apple"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Model
                  </label>
                  <input
                    value={bulkForm.model}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        model: event.target.value,
                      }));
                    }}
                    placeholder="iPhone 15 Pro"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Hafıza
                  </label>
                  <input
                    value={bulkForm.memory}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        memory: event.target.value,
                      }));
                    }}
                    placeholder="256 GB"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Renk
                  </label>
                  <input
                    value={bulkForm.color}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        color: event.target.value,
                      }));
                    }}
                    placeholder="Siyah"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Grade
                  </label>
                  <select
                    value={bulkForm.grade}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        grade: event.target.value as "A" | "B" | "C",
                      }));
                    }}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                  <div className="mt-1.5 text-[7px] font-bold text-slate-400">
                    A → Mükemmel · B → Çok İyi · C → İyi
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Garanti
                  </label>
                  <input
                    value={bulkForm.warranty}
                    onChange={(event) => {
                      setBulkPreview(null);
                      setBulkForm((current) => ({
                        ...current,
                        warranty: event.target.value,
                      }));
                    }}
                    placeholder="12 Ay"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <label className="block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    IMEI Listesi
                  </label>

                  <span className="text-[7px] font-bold text-slate-400">
                    Her satıra 1 IMEI · En fazla 500
                  </span>
                </div>

                <textarea
                  value={bulkImeis}
                  onChange={(event) => {
                    setBulkImeis(
                      event.target.value
                    );
                    setBulkPreview(
                      null
                    );
                    setBulkSuccess(
                      ""
                    );
                  }}
                  rows={10}
                  placeholder={"356111111111111\n356222222222222\n356333333333333"}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-[10px] font-black leading-7 text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              {bulkPreview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50">
                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-slate-400">
                        Toplam
                      </div>
                      <div className="mt-1 text-xl font-black text-slate-900">
                        {bulkPreview.total}
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-emerald-600">
                        Geçerli
                      </div>
                      <div className="mt-1 text-xl font-black text-emerald-700">
                        {bulkPreview.valid}
                      </div>
                    </div>

                    <div className="p-4 text-center">
                      <div className="text-[7px] font-black uppercase text-rose-600">
                        Hatalı
                      </div>
                      <div className="mt-1 text-xl font-black text-rose-700">
                        {bulkPreview.invalid}
                      </div>
                    </div>
                  </div>

                  {bulkPreview.errors.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto divide-y divide-rose-100">
                      {bulkPreview.errors.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={`${item.imei}-${index}`}
                            className="grid gap-1 bg-rose-50/60 px-4 py-3 sm:grid-cols-[170px_1fr]"
                          >
                            <div className="font-mono text-[8px] font-black text-rose-800">
                              {item.imei || "Boş"}
                            </div>
                            <div className="text-[8px] font-bold text-rose-700">
                              {item.reason}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-50 px-4 py-3 text-[8px] font-black text-emerald-700">
                      ✓ Tüm IMEI'ler temiz. Toplu kayıt yapılabilir.
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[8px] font-black text-slate-700">
                  Güvenli toplu kayıt
                </div>
                <div className="mt-1 text-[7px] font-semibold leading-4 text-slate-500">
                  Önizlemede hatalı veya daha önce kayıtlı tek bir IMEI bile varsa toplu kayıt açılmaz. Kayıt anında da tekrar kontrol edilir ve işlem tek transaction içinde tamamlanır.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() =>
                  setBulkOpen(false)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[8px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => {
                  void runBulkDevice(
                    "preview"
                  );
                }}
                className="h-11 rounded-xl border border-blue-200 bg-blue-50 px-6 text-[8px] font-black uppercase tracking-wide text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-50"
              >
                {bulkLoading
                  ? "Kontrol Ediliyor..."
                  : "Önizle / Kontrol Et"}
              </button>

              <button
                type="button"
                disabled={
                  bulkLoading ||
                  !bulkPreview?.canCommit
                }
                onClick={() => {
                  void runBulkDevice(
                    "commit"
                  );
                }}
                className="h-11 rounded-xl bg-blue-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {bulkLoading
                  ? "Kaydediliyor..."
                  : bulkPreview?.canCommit
                  ? `${bulkPreview.total} Cihazı Merkeze Ekle`
                  : "Önce Kontrol Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!addSaving) {
                setAddOpen(false);
              }
            }
          }}
        >
          <div className="my-4 w-full max-w-[980px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-7">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Online · Merkez
                </div>

                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Cihaz Ekle
                </h3>

                <p className="mt-1 text-[9px] font-semibold leading-5 text-slate-500">
                  Cihaz bilgilerini gir. Kayıt yalnızca Merkez stoğuna eklenir; N11, İkas veya başka bir kanala gönderilmez.
                </p>
              </div>

              <button
                type="button"
                disabled={addSaving}
                onClick={() =>
                  setAddOpen(false)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 px-5 py-6 sm:px-7">
              {addError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-black text-rose-700">
                  {addError}
                </div>
              )}

              {addSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-black text-emerald-700">
                  ✓ {addSuccess}
                </div>
              )}

              <div>
                <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                  IMEI
                </label>

                <input
                  inputMode="numeric"
                  autoFocus
                  maxLength={15}
                  value={addForm.imei}
                  onChange={(event) => {
                    const value =
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 15);

                    setAddForm(
                      (current) => ({
                        ...current,
                        imei: value,
                      })
                    );
                  }}
                  placeholder="15 haneli IMEI"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-[10px] font-black text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Marka
                  </label>

                  <input
                    value={addForm.brand}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          brand:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Apple"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Model
                  </label>

                  <input
                    value={addForm.model}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          model:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="iPhone 15 Pro"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Hafıza
                  </label>

                  <input
                    value={addForm.memory}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          memory:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="256 GB"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Renk
                  </label>

                  <input
                    value={addForm.color}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          color:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Siyah"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Grade
                  </label>

                  <select
                    value={addForm.grade}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          grade:
                            event.target
                              .value as
                              | "A"
                              | "B"
                              | "C",
                        })
                      )
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="A">
                      A
                    </option>
                    <option value="B">
                      B
                    </option>
                    <option value="C">
                      C
                    </option>
                  </select>

                  <div className="mt-1.5 text-[7px] font-bold text-slate-400">
                    A → Mükemmel · B → Çok İyi · C → İyi
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase tracking-wide text-slate-500">
                    Garanti
                  </label>

                  <input
                    value={addForm.warranty}
                    onChange={(event) =>
                      setAddForm(
                        (current) => ({
                          ...current,
                          warranty:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="12 Ay"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />

                  <div className="mt-1.5 text-[7px] font-bold text-slate-400">
                    12 AY / 12 Ay / 1 Yıl → 12 Ay olarak standartlaştırılır.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[8px] font-black text-slate-700">
                  Bu adımda yalnızca cihaz kaydı yapılır.
                </div>
                <div className="mt-1 text-[7px] font-semibold leading-4 text-slate-500">
                  Fiyat ve N11 / İkas / İdefix gönderimi daha sonra kanal seçildiğinde girilecek. Pil, mağaza, değişen parça ve kutu/fatura cihaz giriş formunda kullanılmaz.
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
              <button
                type="button"
                disabled={addSaving}
                onClick={() =>
                  setAddOpen(false)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[8px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={addSaving}
                onClick={() => {
                  void saveSingleDevice();
                }}
                className="h-11 rounded-xl bg-blue-600 px-6 text-[8px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
              >
                {addSaving
                  ? "Kaydediliyor..."
                  : "Cihazı Merkeze Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
