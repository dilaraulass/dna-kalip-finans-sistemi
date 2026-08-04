import { DataGrid } from "@mui/x-data-grid";
import { trTR } from "@mui/x-data-grid/locales";
import { useEffect, useMemo, useState } from "react";
import Drawer from "../components/Drawer/Drawer";
import {
  createContract,
  getContractById,
  getContracts,
  updateContract,
} from "../services/contractsApi";
import logo from "../assets/logo.png";
import "./Contracts.css";

const FINANCE_TAB_LABELS = {
  musteri: "Müşteri",
  tedarikci: "Tedarikçi",
};

const CONTRACT_TYPE_LABELS = {
  OFT: "OFT-",
  "OFT-REV": "OFT-REV-",
  TSR: "TSR-",
  TMP: "TMP-",
  MP0: "MP0-",
  FSN: "FSN-",
  REV: "REV-",
};

const CONTRACT_TYPE_OPTIONS_BY_TAB = {
  tedarikci: ["OFT", "TSR", "TMP", "MP0", "FSN", "REV"],
  musteri: ["OFT", "OFT-REV", "MP0", "FSN", "REV"],
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INITIAL_CONTRACT_FORM = {
  contractNumber: "",
  contractType: "OFT",
  contractNumberSuffix: "",
  documentNumber: "DK F 024",
  revisionDate: "",
  publishDate: "2026-04-07",
  financeTab: "musteri",
  companyName: "",
  contractDate: "",
  projectNumber: "",
  customerProject: "",
  workOrderNumber: "",
  referenceNumber: "",
  partName: "",
  moldCount: "1",
  partImage: "",
  moldDesignDates: {},
  moldAmounts: {},
  totalAmount: "",
  currency: "EUR",
  exchangeRateType: "",
  fixedExchangeRate: "",
  workMold: false,
  workWeldingFixture: false,
  workControlFixture: false,
  respProcessDesign: false,
  respMoldDesign: false,
  respMaterialSupply: false,
  respMachining: false,
  respHeatTreatment: false,
  respCoating: false,
  respAssembly: false,
  respPressTryout: false,
  respLaserTryout: false,
  respOffToolTryout: false,
  respMeasurement: false,
  respShipment: false,
  respBuyoff: false,
  dnaOriginalModel: false,
  dnaTechnicalDrawing: false,
  dnaProcessDesign: false,
  dnaMoldDesign: false,
  dnaRawMaterial: false,
  dnaStandardMaterial: false,
  dnaFixture: false,
  docDetailDrawing: false,
  docModelData: false,
  docMoldData: false,
  docMaterialList: false,
  docMeasurementReport: false,
  docCapabilityReport: false,
  docCoatingCertificate: false,
  docMaterialCertificate: false,
  docCncData: false,
  docOperationData: false,
  docHeatTreatmentReport: false,
  designDeliveryDate: "",
  laserDeliveryDate: "",
  subcontractDeliveryDate: "",
  map0DeliveryDate: "",
  offToolDeliveryDate: "",
  sampleApprovalDate: "",
  supplierPaymentOption1: false,
  supplierPaymentOption2: false,
  supplierPaymentOption3: false,
  supplierPaymentOption4: false,
  supplierPaymentOption5: false,
  supplierOpt1Amount40: "",
  supplierOpt1Amount20a: "",
  supplierOpt1Amount20b: "",
  supplierOpt1Amount20c: "",
  supplierOpt2Amount60: "",
  supplierOpt2Amount40: "",
  supplierOpt3Amount100: "",
  supplierOpt4Amount100: "",
  supplierOpt5Amount100: "",
  customerPaymentRate1: "30",
  customerPaymentAmount1: "",
  customerPaymentCondition1: "Kalıp Tasarım Onayı",
  customerPaymentDueDays1: "15",
  customerPaymentRate2: "20",
  customerPaymentAmount2: "",
  customerPaymentCondition2: "Lazer Numune Teslimi",
  customerPaymentDueDays2: "30",
  customerPaymentRate3: "30",
  customerPaymentAmount3: "",
  customerPaymentCondition3: "Min. %95 Uygun Off Tool Parça Teslimi",
  customerPaymentDueDays3: "60",
  customerPaymentRate4: "20",
  customerPaymentAmount4: "",
  customerPaymentCondition4: "Parça, Kalıp Onayı ve PPAP Onayı",
  customerPaymentDueDays4: "60",
  annexTechnicalSpec: true,
  annexSpecialRequests: true,
  annexCustomerSpec: true,
  annexAdministrativeSpec: true,
  signatureDate: "",
  pageCount: "4 (Dört)",
  supplierSignatureName: "",
  customerSignatureName: "",
};

const CONTRACT_EDITOR_CONFIG = {
  tedarikci: {
    tabLabel: "Tedarikçi Sözleşmesi",
    title: "KALIP VE APARAT İMALAT SÖZLEŞMESİ",
    partyPlaceholder: "Tedarikçi seçin veya yazın...",
    dnaRole: "Müşteri",
    counterpartyRole: "TEDARİKÇİ",
    subjectText:
      "Sözleşmenin konusu; DNA KALIP tarafından belirlenen teknik resim, data ve spesifikasyonlara uygun olarak aşağıda detayları belirtilen işin TEDARİKÇİ tarafından eksiksiz ve anahtar teslim üretilmesidir.",
    scopePlaceholder:
      "Açıklama...",
  },
  musteri: {
    tabLabel: "Müşteri Sözleşmesi",
    title: "KALIP İMALAT SATIŞ SÖZLEŞMESİ",
    partyPlaceholder: "Müşteri seçin veya yazın...",
    dnaRole: "TEDARİKÇİ / SATICI",
    counterpartyRole: "MÜŞTERİ",
    subjectText:
      "İşbu sözleşmenin konusu; MÜŞTERİ tarafından teknik şartname, data ve resimleri sağlanan aşağıda detayları belirtilen işin, DNA KALIP tarafından imal edilerek teslim edilmesini kapsar.",
    scopePlaceholder:
      "Müşteri tarafındaki sorumluluk alanını veya detayları yazın...",
  },
};

const SUPPLIER_RESPONSIBILITIES = [
  ["respProcessDesign", "Proses Tasarımı", "Parça verilerine uygun üretim prosesinin planlanması."],
  ["respMoldDesign", "Kalıp Tasarımı", "DNA KALIP onayına sunulacak şekilde tasarımın yapılması."],
  ["respMaterialSupply", "Malzeme Temini", "Gerekli tüm çelik ve standart elemanların tedariki."],
  ["respMachining", "2D & 3D İşlemeler", "CNC, tel erozyon ve diğer talaşlı imalat operasyonları."],
  ["respHeatTreatment", "Isıl İşlem", "Teknik şartnamelere uygun ısıl işlem ve sertifikalandırma."],
  ["respCoating", "Kaplama", "Gerektiğinde yüzey kaplama işlemlerinin yapılması."],
  ["respAssembly", "Montaj", "Tüm kalıp bileşenlerinin hassas montajının yapılması."],
  ["respPressTryout", "Pres Altı Alıştırmalar", "Kalıbın çalışır hale getirilmesi için mekanik alıştırmalar."],
  ["respLaserTryout", "Lazer Deneme", "Lazer kesim saclar ile ilk fonksiyonellik testleri."],
  ["respOffToolTryout", "OFF-TOOL Deneme", "Kalıptan çıkan ilk gerçek baskı denemeleri."],
  ["respMeasurement", "Parça Ölçüselliği", "Numunelerin ölçüsel uygunluğu ve raporlanması."],
  ["respShipment", "Sevk", "Onaylanan kalıpların veya parçaların DNA KALIP lokasyonuna sevki."],
  ["respBuyoff", "Buy-Off ve Kalite Aksiyonları", "Buy-Off denetimleri ve kalite aksiyonlarının kapatılması."],
];

const DNA_SUPPORT_ITEMS = [
  ["dnaOriginalModel", "Orijinal Model"],
  ["dnaTechnicalDrawing", "Teknik Resim"],
  ["dnaProcessDesign", "Proses Tasarımı"],
  ["dnaMoldDesign", "Kalıp Tasarımı"],
  ["dnaRawMaterial", "Hammadde"],
  ["dnaStandardMaterial", "Standart Malzeme"],
  ["dnaFixture", "Fikstür"],
];

const DELIVERY_DOCUMENTS = [
  ["docDetailDrawing", "Aparat Detay Resimleri (dwg veya dxf)"],
  ["docModelData", "Aparat Model Dataları (igs, cat vb.)"],
  ["docMoldData", "Kalıp 2D-3D Dataları"],
  ["docMaterialList", "Malzeme Listesi"],
  ["docMeasurementReport", "Parça Ölçü Kontrol Raporu"],
  ["docCapabilityReport", "Yeterlilik (30 Parça Üzerinden)"],
  ["docCoatingCertificate", "Kaplama Test Sertifikası"],
  ["docMaterialCertificate", "Malzeme Sertifikası"],
  ["docCncData", "CNC ve Tel Erozyon Dataları"],
  ["docOperationData", "Operasyon Bazında Parça Dataları"],
  ["docHeatTreatmentReport", "Isıl İşlem Raporları / Sertifikaları"],
];

const DELIVERY_PLAN_ROWS = [
  ["designDeliveryDate", "Tasarımların Tamamlanması"],
  ["laserDeliveryDate", "Lazer Parça Teslimi"],
  ["subcontractDeliveryDate", "Fason İşleme (Parça Teslimi)"],
  ["map0DeliveryDate", "MAP0 İşçilik Teslimi (Montajlı Onay)"],
  ["offToolDeliveryDate", "%100 Ölçüsel Off-Tool Parça Teslimi"],
  ["sampleApprovalDate", "%100 Numune Onayı ve Kalıbın Sevk Edilmesi"],
];

const CUSTOMER_DELIVERY_PLAN_ROWS = [
  ["designDeliveryDate", "Tasarım Onayı (Müşteri Onayına Sunulması)"],
  ["map0DeliveryDate", "MAP0 / Montajlı Fiziki Teslimat"],
  ["offToolDeliveryDate", "Numune (PPAP / OFF-TOOL) ve CMM Rapor Teslimi"],
  ["sampleApprovalDate", "Seri Üretim Onayı (Final Onay)"],
];

const ANNEX_ITEMS = [
  ["annexTechnicalSpec", "DNA Kalıp Teknik Şartnamesi"],
  ["annexSpecialRequests", "DNA Kalıp Özel İstekleri"],
  ["annexCustomerSpec", "Müşteri Şartnamesi"],
  ["annexAdministrativeSpec", "İdari Şartname"],
];

const SUPPLIER_RESPONSIBILITY_FIELDS = SUPPLIER_RESPONSIBILITIES.map(
  ([name]) => name,
);
const DNA_SUPPORT_FIELDS = DNA_SUPPORT_ITEMS.map(([name]) => name);
const DELIVERY_DOCUMENT_FIELDS = DELIVERY_DOCUMENTS.map(([name]) => name);
const SUPPLIER_PAYMENT_OPTION_FIELDS = [
  "supplierPaymentOption1",
  "supplierPaymentOption2",
  "supplierPaymentOption3",
  "supplierPaymentOption4",
  "supplierPaymentOption5",
];
const ANNEX_FIELDS = ANNEX_ITEMS.map(([name]) => name);

const SUPPLIER_CONTRACT_TYPE_DEFAULTS = {
  OFT: {
    paymentOption: "supplierPaymentOption1",
    responsibilities: SUPPLIER_RESPONSIBILITY_FIELDS,
    dnaSupport: ["dnaOriginalModel", "dnaTechnicalDrawing", "dnaFixture"],
    documents: DELIVERY_DOCUMENT_FIELDS,
  },
  "OFT-REV": {
    paymentOption: "supplierPaymentOption1",
    responsibilities: SUPPLIER_RESPONSIBILITY_FIELDS,
    dnaSupport: ["dnaOriginalModel", "dnaTechnicalDrawing", "dnaFixture"],
    documents: DELIVERY_DOCUMENT_FIELDS,
  },
  TSR: {
    paymentOption: "supplierPaymentOption3",
    responsibilities: ["respProcessDesign", "respMoldDesign"],
    dnaSupport: ["dnaOriginalModel", "dnaTechnicalDrawing"],
    documents: ["docMoldData", "docMaterialList"],
  },
  TMP: {
    paymentOption: "supplierPaymentOption2",
    responsibilities: [
      "respMoldDesign",
      "respMaterialSupply",
      "respMachining",
      "respHeatTreatment",
      "respCoating",
      "respAssembly",
      "respShipment",
      "respBuyoff",
    ],
    dnaSupport: [
      "dnaOriginalModel",
      "dnaTechnicalDrawing",
      "dnaProcessDesign",
    ],
    documents: [
      "docMoldData",
      "docMaterialList",
      "docMaterialCertificate",
      "docHeatTreatmentReport",
      "docMeasurementReport",
    ],
  },
  MP0: {
    paymentOption: "supplierPaymentOption4",
    responsibilities: [
      "respMachining",
      "respAssembly",
      "respShipment",
      "respBuyoff",
      "respPressTryout",
    ],
    dnaSupport: [
      "dnaOriginalModel",
      "dnaTechnicalDrawing",
      "dnaProcessDesign",
      "dnaMoldDesign",
      "dnaRawMaterial",
      "dnaStandardMaterial",
    ],
    documents: ["docMeasurementReport"],
  },
  FSN: {
    paymentOption: "supplierPaymentOption5",
    responsibilities: ["respMachining", "respShipment", "respBuyoff"],
    dnaSupport: [
      "dnaOriginalModel",
      "dnaTechnicalDrawing",
      "dnaProcessDesign",
      "dnaMoldDesign",
      "dnaRawMaterial",
      "dnaStandardMaterial",
    ],
    documents: ["docCncData", "docOperationData"],
  },
  REV: {
    paymentOption: "supplierPaymentOption5",
    responsibilities: [
      "respMachining",
      "respAssembly",
      "respShipment",
      "respBuyoff",
    ],
    dnaSupport: ["dnaMoldDesign"],
    documents: ["docMeasurementReport"],
  },
};

const CUSTOMER_PAYMENT_FIELDS = [
  ["customerPaymentRate1", "customerPaymentCondition1", "customerPaymentDueDays1"],
  ["customerPaymentRate2", "customerPaymentCondition2", "customerPaymentDueDays2"],
  ["customerPaymentRate3", "customerPaymentCondition3", "customerPaymentDueDays3"],
  ["customerPaymentRate4", "customerPaymentCondition4", "customerPaymentDueDays4"],
];

const CUSTOMER_OFT_PAYMENT_DEFAULTS = [
  ["30", "Kalıp Tasarım Onayı", "15"],
  ["20", "Lazer Numune Teslimi", "30"],
  ["30", "Min. %95 Uygun Off Tool Parça Teslimi", "60"],
  ["20", "Parça, Kalıp Onayı ve PPAP Onayı", "60"],
];

const CUSTOMER_SINGLE_PAYMENT_DEFAULTS = [
  ["100", "İş Tesliminde", "60"],
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];

function formatMoney(amount, currency) {
  return `${currencyFormatter.format(amount ?? 0)} ${currency || ""}`.trim();
}

function formatFinanceTab(financeTab) {
  return FINANCE_TAB_LABELS[financeTab] || financeTab || "-";
}

function formatValue(value) {
  return value || "-";
}

function getContractTypeOptions(financeTab) {
  return (
    CONTRACT_TYPE_OPTIONS_BY_TAB[financeTab] ||
    CONTRACT_TYPE_OPTIONS_BY_TAB.musteri
  );
}

function getValidContractType(financeTab, contractType) {
  const options = getContractTypeOptions(financeTab);

  return options.includes(contractType) ? contractType : options[0];
}

function applySupplierContractTypeDefaults(form, contractType) {
  const defaults = SUPPLIER_CONTRACT_TYPE_DEFAULTS[contractType];

  if (!defaults || form.financeTab !== "tedarikci") {
    return form;
  }

  const nextForm = {
    ...form,
    contractType,
  };

  SUPPLIER_PAYMENT_OPTION_FIELDS.forEach((fieldName) => {
    nextForm[fieldName] = fieldName === defaults.paymentOption;
  });

  SUPPLIER_RESPONSIBILITY_FIELDS.forEach((fieldName) => {
    nextForm[fieldName] = defaults.responsibilities.includes(fieldName);
  });

  DNA_SUPPORT_FIELDS.forEach((fieldName) => {
    nextForm[fieldName] = defaults.dnaSupport.includes(fieldName);
  });

  DELIVERY_DOCUMENT_FIELDS.forEach((fieldName) => {
    nextForm[fieldName] = defaults.documents.includes(fieldName);
  });

  ANNEX_FIELDS.forEach((fieldName) => {
    nextForm[fieldName] = true;
  });

  return nextForm;
}

function applyCustomerContractTypeDefaults(form, contractType) {
  if (form.financeTab !== "musteri") {
    return form;
  }

  const paymentDefaults =
    contractType === "OFT"
      ? CUSTOMER_OFT_PAYMENT_DEFAULTS
      : CUSTOMER_SINGLE_PAYMENT_DEFAULTS;
  const nextForm = {
    ...form,
    contractType,
  };

  CUSTOMER_PAYMENT_FIELDS.forEach(
    ([rateField, conditionField, dueDaysField], index) => {
      const [rate, condition, dueDays] = paymentDefaults[index];

      nextForm[rateField] = rate;
      nextForm[conditionField] = condition;
      nextForm[dueDaysField] = dueDays;
    },
  );

  return nextForm;
}

function applyContractTypeDefaults(form, contractType) {
  if (form.financeTab === "tedarikci") {
    return applySupplierContractTypeDefaults(form, contractType);
  }

  return applyCustomerContractTypeDefaults(form, contractType);
}

function buildNextContractForm(currentForm, event) {
  const { checked, name, type, value } = event.target;
  const nextValue = type === "checkbox" ? checked : value;
  const nextForm = {
    ...currentForm,
    [name]: nextValue,
  };

  if (name === "contractType") {
    return applyContractTypeDefaults(nextForm, value);
  }

  if (name === "financeTab") {
    const validContractType = getValidContractType(value, nextForm.contractType);

    return applyContractTypeDefaults(
      {
        ...nextForm,
        contractType: validContractType,
      },
      validContractType,
    );
  }

  return nextForm;
}

function parseContractFormData(formDataJson) {
  if (!formDataJson) return null;

  try {
    return {
      ...INITIAL_CONTRACT_FORM,
      ...JSON.parse(formDataJson),
    };
  } catch {
    return null;
  }
}

function buildContractFormFromDetail(contract) {
  const parsedFormData = parseContractFormData(contract.formDataJson);

  if (parsedFormData) {
    return parsedFormData;
  }

  return {
    ...INITIAL_CONTRACT_FORM,
    contractNumber: contract.contractNumber || "",
    financeTab: contract.financeTab || INITIAL_CONTRACT_FORM.financeTab,
    contractType: contract.contractType || INITIAL_CONTRACT_FORM.contractType,
    contractNumberSuffix:
      contract.contractNumberSuffix || INITIAL_CONTRACT_FORM.contractNumberSuffix,
    companyName: contract.company?.name || "",
    contractDate: contract.contractDate || "",
    projectNumber: contract.projectNumber || "",
    customerProject: contract.customerProject || "",
    workOrderNumber: contract.workOrderNumber || "",
    referenceNumber: contract.referenceNumber || "",
    partName: contract.partName || "",
    moldCount: String(contract.moldCount || INITIAL_CONTRACT_FORM.moldCount),
    totalAmount:
      contract.totalAmount === null || contract.totalAmount === undefined
        ? ""
        : String(contract.totalAmount),
    currency: contract.currency || INITIAL_CONTRACT_FORM.currency,
    exchangeRateType: contract.exchangeRateType || "",
    fixedExchangeRate:
      contract.fixedExchangeRate === null ||
      contract.fixedExchangeRate === undefined
        ? ""
        : String(contract.fixedExchangeRate),
  };
}

function parseAmount(value) {
  if (!value) return 0;

  const normalized = value.toString().replace(/\./g, "").replace(",", ".");
  return Number(normalized) || 0;
}

function numberToTurkishWords(value) {
  const ones = [
    "",
    "Bir",
    "İki",
    "Üç",
    "Dört",
    "Beş",
    "Altı",
    "Yedi",
    "Sekiz",
    "Dokuz",
  ];
  const tens = [
    "",
    "On",
    "Yirmi",
    "Otuz",
    "Kırk",
    "Elli",
    "Altmış",
    "Yetmiş",
    "Seksen",
    "Doksan",
  ];

  function underThousand(number) {
    const hundred = Math.floor(number / 100);
    const ten = Math.floor((number % 100) / 10);
    const one = number % 10;

    return [
      hundred > 1 ? ones[hundred] : "",
      hundred > 0 ? "Yüz" : "",
      tens[ten],
      ones[one],
    ]
      .filter(Boolean)
      .join(" ");
  }

  const number = Math.floor(Math.abs(value));
  if (number === 0) return "Sıfır";

  const groups = [
    ["Milyar", Math.floor(number / 1_000_000_000) % 1000],
    ["Milyon", Math.floor(number / 1_000_000) % 1000],
    ["Bin", Math.floor(number / 1000) % 1000],
    ["", number % 1000],
  ];

  return groups
    .map(([suffix, groupValue]) => {
      if (!groupValue) return "";
      if (suffix === "Bin" && groupValue === 1) return "Bin";
      return `${underThousand(groupValue)} ${suffix}`.trim();
    })
    .filter(Boolean)
    .join(" ");
}

function formatAmountInWords(amount, currency) {
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) return "";

  return `${numberToTurkishWords(parsedAmount)} ${currency || ""}`.trim();
}

function getMoldIndexes(moldCount) {
  const count = Math.min(Math.max(Number(moldCount) || 1, 1), 15);
  return Array.from({ length: count }, (_, index) => index);
}

function calculatePaymentAmount(totalAmount, rate, currency) {
  const amount = (parseAmount(totalAmount) * (Number(rate) || 0)) / 100;

  if (!amount) return "-";

  return formatMoney(amount, currency);
}

function getCustomerPaymentRateTotal(form) {
  return [
    form.customerPaymentRate1,
    form.customerPaymentRate2,
    form.customerPaymentRate3,
    form.customerPaymentRate4,
  ].reduce((sum, rate) => sum + (Number(rate) || 0), 0);
}

function buildContractPayload(form) {
  const contractType = form.contractType.trim();
  const contractSuffix = form.contractNumberSuffix.trim();
  const generatedContractNumber =
    form.financeTab === "tedarikci"
      ? `DNA-26-${contractType}-${contractSuffix}`
      : `DNA-${contractType}-${contractSuffix}`;

  return {
    contractNumber: form.contractNumber.trim() || generatedContractNumber,
    financeTab: form.financeTab,
    contractType,
    contractNumberSuffix: contractSuffix,
    companyName: form.companyName.trim(),
    contractDate: form.contractDate || null,
    projectNumber: form.projectNumber.trim() || null,
    customerProject: form.customerProject.trim() || null,
    workOrderNumber: form.workOrderNumber.trim() || null,
    referenceNumber: form.referenceNumber.trim() || null,
    partName: form.partName.trim() || null,
    moldCount: Number(form.moldCount || 1),
    totalAmount: parseAmount(form.totalAmount),
    currency: form.currency,
    exchangeRateType: form.exchangeRateType || null,
    fixedExchangeRate: form.fixedExchangeRate
      ? parseAmount(form.fixedExchangeRate)
      : null,
    formDataJson: JSON.stringify(form),
  };
}

function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [financeTabFilter, setFinanceTabFilter] = useState("all");
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CONTRACT_FORM);
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editForm, setEditForm] = useState(INITIAL_CONTRACT_FORM);
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContracts() {
      try {
        setLoading(true);
        setError("");
        const data = await getContracts({ signal: controller.signal });
        setContracts(data);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError("Sözleşmeler yüklenirken bir hata oluştu.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadContracts();

    return () => controller.abort();
  }, []);

  const filteredContracts = useMemo(() => {
    const search = searchText.trim().toLocaleLowerCase("tr-TR");

    return contracts.filter((contract) => {
      const matchesFinanceTab =
        financeTabFilter === "all" ||
        contract.financeTab === financeTabFilter;
      const matchesSearch =
        !search ||
        [
          contract.contractNumber,
          contract.companyName,
          contract.workOrderNumber,
          contract.projectNumber,
          contract.customerProject,
          contract.partName,
        ]
          .filter(Boolean)
          .some((value) =>
            value.toLocaleLowerCase("tr-TR").includes(search),
          );

      return matchesFinanceTab && matchesSearch;
    });
  }, [contracts, financeTabFilter, searchText]);

  const summary = useMemo(
    () => ({
      total: contracts.length,
      customers: contracts.filter(
        (contract) => contract.financeTab === "musteri",
      ).length,
      suppliers: contracts.filter(
        (contract) => contract.financeTab === "tedarikci",
      ).length,
      milestones: contracts.reduce(
        (total, contract) => total + contract.milestoneCount,
        0,
      ),
    }),
    [contracts],
  );

  const columns = [
    {
      field: "contractNumber",
      headerName: "Sözleşme No",
      width: 160,
    },
    {
      field: "financeTab",
      headerName: "Tür",
      width: 115,
      valueFormatter: (value) => formatFinanceTab(value),
    },
    {
      field: "companyName",
      headerName: "Firma",
      width: 190,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "workOrderNumber",
      headerName: "İş Emri",
      width: 110,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "contractDate",
      headerName: "Tarih",
      width: 120,
      valueFormatter: (value) => formatValue(value),
    },
    {
      field: "totalAmount",
      headerName: "Tutar",
      width: 145,
      valueFormatter: (value, row) => formatMoney(value, row.currency),
    },
    {
      field: "milestoneCount",
      headerName: "Hakediş",
      width: 95,
    },
    {
      field: "paidMilestoneCount",
      headerName: "Ödenen",
      width: 95,
    },
    {
      field: "partName",
      headerName: "Parça",
      flex: 1,
      minWidth: 160,
      valueFormatter: (value) => formatValue(value),
    },
  ];

  async function handleContractSelect(contractId) {
    setSelectedContractId(contractId);
    setSelectedContract(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const detail = await getContractById(contractId);
      setSelectedContract(detail);
    } catch {
      setDetailError("Sözleşme detayı yüklenirken bir hata oluştu.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedContractId(null);
    setSelectedContract(null);
    setDetailError("");
    setDetailLoading(false);
    setPreviewDrawerOpen(false);
    setEditDrawerOpen(false);
    setEditError("");
  }

  function openCreateDrawer() {
    setCreateForm(INITIAL_CONTRACT_FORM);
    setCreateError("");
    setCreateDrawerOpen(true);
  }

  function closeCreateDrawer() {
    if (createSubmitting) return;

    setCreateDrawerOpen(false);
    setCreateError("");
  }

  function openPreviewDrawer() {
    setPreviewDrawerOpen(true);
  }

  function closePreviewDrawer() {
    setPreviewDrawerOpen(false);
  }

  function openEditDrawer() {
    if (!selectedContract) return;

    setEditForm(buildContractFormFromDetail(selectedContract));
    setEditError("");
    setPreviewDrawerOpen(false);
    setEditDrawerOpen(true);
  }

  function closeEditDrawer() {
    if (editSubmitting) return;

    setEditDrawerOpen(false);
    setEditError("");
  }

  function handleCreateFormChange(event) {
    setCreateForm((currentForm) => buildNextContractForm(currentForm, event));
  }

  function handleEditFormChange(event) {
    setEditForm((currentForm) => buildNextContractForm(currentForm, event));
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    setCreateError("");

    const customerPaymentRateTotal = getCustomerPaymentRateTotal(createForm);

    if (
      createForm.financeTab === "musteri" &&
      customerPaymentRateTotal !== 100
    ) {
      setCreateError(
        `Ödeme oranları toplamı %100 olmalıdır. Şu an: %${customerPaymentRateTotal}`,
      );
      return;
    }

    setCreateSubmitting(true);

    const payload = buildContractPayload(createForm);

    try {
      const createdContract = await createContract(payload);
      const refreshedContracts = await getContracts();

      setContracts(refreshedContracts);
      setCreateDrawerOpen(false);
      setCreateForm(INITIAL_CONTRACT_FORM);
      setSelectedContractId(createdContract.id);
      setSelectedContract(createdContract);
    } catch (requestError) {
      setCreateError(requestError.message || "Sözleşme oluşturulamadı.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    if (!selectedContract) return;

    setEditError("");

    const customerPaymentRateTotal = getCustomerPaymentRateTotal(editForm);

    if (
      editForm.financeTab === "musteri" &&
      customerPaymentRateTotal !== 100
    ) {
      setEditError(
        `Ödeme oranları toplamı %100 olmalıdır. Şu an: %${customerPaymentRateTotal}`,
      );
      return;
    }

    setEditSubmitting(true);

    const payload = buildContractPayload(editForm);

    try {
      const updatedContract = await updateContract(selectedContract.id, payload);
      const refreshedContracts = await getContracts();

      setContracts(refreshedContracts);
      setSelectedContractId(updatedContract.id);
      setSelectedContract(updatedContract);
      setEditDrawerOpen(false);
    } catch (requestError) {
      setEditError(requestError.message || "Sözleşme güncellenemedi.");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <section className="contracts-page">
      <div className="contracts-summary-grid">
        <button
          type="button"
          className={`contracts-summary-card total ${
            financeTabFilter === "all" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("all")}
        >
          <span>Toplam Sözleşme</span>
          <strong>{summary.total}</strong>
        </button>
        <button
          type="button"
          className={`contracts-summary-card customer ${
            financeTabFilter === "musteri" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("musteri")}
        >
          <span>Müşteri Sözleşmesi</span>
          <strong>{summary.customers}</strong>
        </button>
        <button
          type="button"
          className={`contracts-summary-card supplier ${
            financeTabFilter === "tedarikci" ? "selected" : ""
          }`}
          onClick={() => setFinanceTabFilter("tedarikci")}
        >
          <span>Tedarikçi Sözleşmesi</span>
          <strong>{summary.suppliers}</strong>
        </button>
        <div className="contracts-summary-card milestones">
          <span>Toplam Hakediş</span>
          <strong>{summary.milestones}</strong>
        </div>
      </div>

      <div className="contracts-panel">
        <div className="contracts-header">
          <div>
            <h2>Sözleşmeler</h2>
            <p>{filteredContracts.length} kayıt gösteriliyor</p>
          </div>

          <div className="contracts-actions">
            <button
              type="button"
              className="contracts-primary-btn"
              onClick={openCreateDrawer}
            >
              Yeni Sözleşme
            </button>

            <input
              className="contracts-search"
              type="text"
              placeholder="Sözleşme, firma, iş emri ara..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            <select
              className="contracts-filter"
              value={financeTabFilter}
              onChange={(event) => setFinanceTabFilter(event.target.value)}
            >
              <option value="all">Tümü</option>
              <option value="musteri">Müşteri</option>
              <option value="tedarikci">Tedarikçi</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="contracts-status">Sözleşmeler yükleniyor...</div>
        )}

        {!loading && error && (
          <div className="contracts-status error">{error}</div>
        )}

        {!loading && !error && (
          <div style={{ height: 560, width: "100%" }}>
            <DataGrid
              rows={filteredContracts}
              columns={columns}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 10, page: 0 },
                },
                sorting: {
                  sortModel: [{ field: "contractDate", sort: "desc" }],
                },
              }}
              localeText={trTR.components.MuiDataGrid.defaultProps.localeText}
              disableRowSelectionOnClick
              onRowClick={(params) => handleContractSelect(params.id)}
              getRowClassName={(params) =>
                params.id === selectedContractId ? "selected-grid-row" : ""
              }
            />
          </div>
        )}
      </div>

      <Drawer
        isOpen={!!selectedContractId}
        onClose={closeDrawer}
        title="Sözleşme Detayı"
        subtitle={selectedContract?.contractNumber}
        width={620}
      >
        {detailLoading && (
          <div className="contracts-status">Detay yükleniyor...</div>
        )}

        {!detailLoading && detailError && (
          <div className="contracts-status error">{detailError}</div>
        )}

        {!detailLoading && selectedContract && (
          <ContractDetail
            contract={selectedContract}
            onPreview={openPreviewDrawer}
            onEdit={openEditDrawer}
          />
        )}
      </Drawer>

      <Drawer
        isOpen={previewDrawerOpen}
        onClose={closePreviewDrawer}
        width={980}
        hideHeader
      >
        {selectedContract && (
          <ContractPreview
            contract={selectedContract}
            onCancel={closePreviewDrawer}
          />
        )}
      </Drawer>

      <Drawer
        isOpen={editDrawerOpen}
        onClose={closeEditDrawer}
        width={980}
        hideHeader
      >
        <CreateContractForm
          form={editForm}
          error={editError}
          submitting={editSubmitting}
          onChange={handleEditFormChange}
          onSubmit={handleEditSubmit}
          onCancel={closeEditDrawer}
          submitLabel="Değişiklikleri Kaydet"
        />
      </Drawer>

      <Drawer
        isOpen={createDrawerOpen}
        onClose={closeCreateDrawer}
        width={980}
        hideHeader
      >
        <CreateContractForm
          form={createForm}
          error={createError}
          submitting={createSubmitting}
          onChange={handleCreateFormChange}
          onSubmit={handleCreateSubmit}
          onCancel={closeCreateDrawer}
          submitLabel="Sözleşme Oluştur"
        />
      </Drawer>
    </section>
  );
}

function CreateContractForm({
  form,
  error,
  submitting,
  onChange,
  onSubmit,
  onCancel,
  readOnly = false,
  submitLabel = "Sözleşme Oluştur",
}) {
  const activeTemplate = CONTRACT_EDITOR_CONFIG[form.financeTab];
  const contractTypeOptions = getContractTypeOptions(form.financeTab);
  const totalPages = form.financeTab === "tedarikci" ? 4 : 2;
  const [partImageError, setPartImageError] = useState("");

  function changeContractType(financeTab) {
    if (readOnly) return;

    onChange({
      target: {
        name: "financeTab",
        value: financeTab,
      },
    });
  }

  function handlePartImageUpload(event) {
    if (readOnly) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPartImageError("Sadece görsel dosyası yükleyebilirsiniz.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPartImageError("Görsel boyutu en fazla 2 MB olmalıdır.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPartImageError("");
      onChange({
        target: {
          name: "partImage",
          value: reader.result || "",
        },
      });
      event.target.value = "";
    };
    reader.onerror = () => {
      setPartImageError("Görsel okunurken bir hata oluştu.");
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function handleNestedFormChange(fieldName, key, value) {
    if (readOnly) return;

    onChange({
      target: {
        name: fieldName,
        value: {
          ...(form[fieldName] || {}),
          [key]: value,
        },
      },
    });
  }

  return (
    <form
      className={`contract-form ${readOnly ? "contract-form-readonly" : ""}`}
      onSubmit={onSubmit}
    >
      {error && <div className="contracts-status error">{error}</div>}

      <div className="contract-editor-tabs">
        {Object.entries(CONTRACT_EDITOR_CONFIG).map(([financeTab, config]) => (
          <button
            key={financeTab}
            type="button"
            className={form.financeTab === financeTab ? "active" : ""}
            onClick={() => changeContractType(financeTab)}
          >
            {config.tabLabel}
          </button>
        ))}
      </div>

      <div className="contract-document-stack">
        <A4Page financeTab={form.financeTab} pageNum={1} totalPages={totalPages}>
            <ContractDocumentHeader form={form} onChange={onChange} />

            <h2>{activeTemplate.title}</h2>

            <div className="contract-document-number">
              <span>Sözleşme No:</span>
              <div className="contract-number-builder">
                <span>DNA-</span>
                {form.financeTab === "tedarikci" && <span>26-</span>}
                <select
                  name="contractType"
                  value={form.contractType}
                  onChange={onChange}
                >
                  {contractTypeOptions.map((contractType) => (
                    <option key={contractType} value={contractType}>
                      {CONTRACT_TYPE_LABELS[contractType]}
                    </option>
                  ))}
                </select>
                <input
                  name="contractNumberSuffix"
                  value={form.contractNumberSuffix}
                  onChange={onChange}
                  placeholder={form.financeTab === "tedarikci" ? "001" : "26001"}
                  required
                />
              </div>
            </div>

            {form.financeTab === "tedarikci" && (
              <div className="contract-meta-row">
                <EditableField
                  label="Proje No"
                  name="projectNumber"
                  value={form.projectNumber}
                  onChange={onChange}
                />
                <EditableField
                  label="Tarih"
                  name="contractDate"
                  type="date"
                  value={form.contractDate}
                  onChange={onChange}
                />
              </div>
            )}

            <section className="contract-document-section">
              <h3>Madde 1: Taraflar</h3>
              <p>
                İşbu sözleşme, bir tarafta <strong>DNA KALIP</strong> (bundan
                böyle <strong>"{activeTemplate.dnaRole}"</strong> olarak
                anılacaktır) ile diğer tarafta
                <input
                  name="companyName"
                  value={form.companyName}
                  onChange={onChange}
                  placeholder={activeTemplate.partyPlaceholder}
                  required
                />
                (bundan böyle <strong>"{activeTemplate.counterpartyRole}"</strong>{" "}
                olarak anılacaktır) arasında akdedilmiştir.
              </p>
            </section>

            <section className="contract-document-section">
              <h3>
                {form.financeTab === "tedarikci"
                  ? "Madde 2: Sözleşmenin Konusu ve Kapsamı"
                  : "Madde 2: Sözleşmenin Konusu"}
              </h3>
              <p>{activeTemplate.subjectText}</p>

              <div className="contract-document-info-card">
                <div className="contract-document-info-grid">
                  <EditableField
                    label={form.financeTab === "tedarikci" ? "Müşteri" : "Proje"}
                    name="projectNumber"
                    value={form.projectNumber}
                    onChange={onChange}
                  />
                  <EditableField
                    label="Parça Referans No"
                    name="referenceNumber"
                    value={form.referenceNumber}
                    onChange={onChange}
                  />
                  <EditableField
                    label="İş Emri No"
                    name="workOrderNumber"
                    value={form.workOrderNumber}
                    onChange={onChange}
                  />
                  <EditableField
                    label="Parça Adı"
                    name="partName"
                    value={form.partName}
                    onChange={onChange}
                  />
                  <EditableField
                    label={
                      form.financeTab === "tedarikci"
                        ? "Adet"
                        : "Kalıp / Aparat Adedi"
                    }
                    name="moldCount"
                    type="number"
                    min="1"
                    max="15"
                    value={form.moldCount}
                    onChange={onChange}
                  />
                </div>

                <div className="contract-document-image-placeholder">
                  {form.partImage ? (
                    <>
                      <img src={form.partImage} alt="Parça Görseli" />
                      <button
                        type="button"
                        onClick={() => {
                          setPartImageError("");
                          onChange({
                            target: {
                              name: "partImage",
                              value: "",
                            },
                          });
                        }}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <label>
                      <span>
                        {form.financeTab === "tedarikci"
                          ? "parça görseli"
                          : "parça görseli ekle"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePartImageUpload}
                      />
                    </label>
                  )}
                </div>
                {partImageError && (
                  <div className="contract-document-image-error">
                    {partImageError}
                  </div>
                )}

                <label className="contract-document-textarea">
                  <span>
                    {form.financeTab === "tedarikci"
                      ? "Açıklama"
                      : "İş Tanımı & Kapsam"}
                  </span>
                  <textarea
                    name="customerProject"
                    value={form.customerProject}
                    onChange={onChange}
                    placeholder={activeTemplate.scopePlaceholder}
                  />
                </label>
              </div>

              {form.financeTab === "tedarikci" && (
                <>
                  <div className="contract-work-type-row">
                    <CheckboxField
                      name="workMold"
                      checked={form.workMold}
                      onChange={onChange}
                      label="Kalıp İmalatı"
                    />
                    <CheckboxField
                      name="workWeldingFixture"
                      checked={form.workWeldingFixture}
                      onChange={onChange}
                      label="Kaynak Aparatı"
                    />
                    <CheckboxField
                      name="workControlFixture"
                      checked={form.workControlFixture}
                      onChange={onChange}
                      label="Kontrol Aparatı"
                    />
                  </div>

                  <div className="contract-abbreviations">
                    <strong>Sözleşme Kısaltmaları:</strong>
                    <span><strong>OFT:</strong> OFF TOOL</span>
                    <span><strong>TSR:</strong> TASARIM</span>
                    <span><strong>TMP:</strong> TASARIM + MAP0 İŞÇİLİK</span>
                    <span><strong>MP0:</strong> MAP0 İŞÇİLİK</span>
                    <span><strong>FSN:</strong> FASON İŞÇİLİK</span>
                    <span><strong>REV:</strong> REVİZYON</span>
                  </div>
                </>
              )}
            </section>
        </A4Page>

        {form.financeTab === "tedarikci" && (
          <>
            <A4Page financeTab={form.financeTab} pageNum={2} totalPages={4}>
              <SupplierResponsibilitiesSection form={form} onChange={onChange} />
            </A4Page>

            <A4Page financeTab={form.financeTab} pageNum={3} totalPages={4}>
              <DeliveryDocumentsSection form={form} onChange={onChange} />
                <DeliveryPlanSection
                  form={form}
                  onChange={onChange}
                  title="Madde 5: Termin ve Teslimat Planı"
                  rows={DELIVERY_PLAN_ROWS}
                  onNestedChange={handleNestedFormChange}
                />
              <SupplierPaymentTermsSection
                form={form}
                onChange={onChange}
                onNestedChange={handleNestedFormChange}
              />
            </A4Page>

            <A4Page financeTab={form.financeTab} pageNum={4} totalPages={4}>
              <FinalTermsSection form={form} onChange={onChange} />
            </A4Page>
          </>
        )}

        {form.financeTab === "musteri" && (
          <A4Page financeTab={form.financeTab} pageNum={2} totalPages={2}>
                <DeliveryPlanSection
                  form={form}
                  onChange={onChange}
                  title="Madde 3: Termin ve Teslimat Planı"
                  rows={CUSTOMER_DELIVERY_PLAN_ROWS}
                  onNestedChange={handleNestedFormChange}
                />
                <CustomerPaymentTermsSection form={form} onChange={onChange} />
                <CustomerSignatureSection form={form} />
          </A4Page>
        )}
      </div>

      <div className="contract-form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          {readOnly ? "Kapat" : "Vazgeç"}
        </button>
        {!readOnly && (
          <button
            type="submit"
            className="contracts-primary-btn"
            disabled={submitting}
          >
            {submitting ? "Kaydediliyor..." : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}

function ContractPreview({ contract, onCancel }) {
  const previewForm = buildContractFormFromDetail(contract);

  function handlePreviewSubmit(event) {
    event.preventDefault();
  }

  function ignorePreviewChange() {
    // Önizleme modunda veriyi değiştirmiyoruz.
  }

  return (
    <div>
      {!contract.formDataJson && (
        <div className="contracts-status warning">
          Bu kayıt eski formatta oluşturulmuş. Şablon, ana sözleşme
          bilgilerinden mümkün olduğunca dolduruldu.
        </div>
      )}

      <CreateContractForm
        form={previewForm}
        error=""
        submitting={false}
        onChange={ignorePreviewChange}
        onSubmit={handlePreviewSubmit}
        onCancel={onCancel}
        readOnly
      />
    </div>
  );
}

function A4Page({ children, financeTab, pageNum, totalPages }) {
  return (
    <div
      className={`contract-document-editor ${
        financeTab === "musteri"
          ? "contract-document-editor-customer"
          : "contract-document-editor-supplier"
      }`}
    >
      <div className="contract-document-page-content">{children}</div>
      <ContractPageFooter activePage={pageNum} totalPages={totalPages} />
    </div>
  );
}

function ContractDocumentHeader({ form, onChange }) {
  return (
    <div className="contract-document-header">
      <div className="contract-document-logo">
        <img src={logo} alt="Kurumsal Logo" />
      </div>
      <table>
        <tbody>
          <tr>
            <td>Doküman No:</td>
            <td>
              <input
                name="documentNumber"
                value={form.documentNumber}
                onChange={onChange}
              />
            </td>
          </tr>
          {form.financeTab === "tedarikci" && (
            <>
              <tr>
                <td>Değ. Tarihi:</td>
                <td>
                  <input
                    type="date"
                    name="revisionDate"
                    value={form.revisionDate}
                    onChange={onChange}
                  />
                </td>
              </tr>
              <tr>
                <td>Yayın Tarihi:</td>
                <td>
                  <input
                    type="date"
                    name="publishDate"
                    value={form.publishDate}
                    onChange={onChange}
                  />
                </td>
              </tr>
            </>
          )}
          {form.financeTab === "musteri" && (
            <tr>
              <td>Tarih:</td>
              <td>
                <input
                  type="date"
                  name="contractDate"
                  value={form.contractDate}
                  onChange={onChange}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ContractPageFooter({ activePage, totalPages }) {
  return (
    <div className="contract-page-footer">
      <span>
        {activePage} / {totalPages}
      </span>
    </div>
  );
}

function SupplierResponsibilitiesSection({ form, onChange }) {
  return (
    <section className="contract-document-section">
      <h3>Madde 3: Sorumluluklar</h3>

      <div className="contract-subsection">
        <h4>3.1 Tedarikçi Sorumlulukları</h4>
        <p>
          Projenin başından sonuna kadar olan süreçte tedarikçi, aşağıda
          işaretlenen işlemlerin eksiksiz yerine getirilmesinden sorumludur.
        </p>
        <div className="contract-checkbox-list">
          {SUPPLIER_RESPONSIBILITIES.map(([name, boldText, label]) => (
            <CheckboxField
              key={name}
              name={name}
              checked={form[name]}
              onChange={onChange}
              boldText={boldText}
              label={label}
            />
          ))}
        </div>
      </div>

      <div className="contract-note-box">
        <h4>Özel ve İlave Şartlar:</h4>
        <ul>
          <li>
            <strong>(OFF-TOOL)</strong> Seriye girene kadar talep edilmesi
            durumunda malzemesi DNA KALIP tarafından sağlanmak kaydı ile
            <strong> tüm numune, önseri üretimleri TEDARİKÇİ sorumluluğundadır.</strong>
          </li>
          <li>
            <strong>(OFF-TOOL)</strong> İlgili proses (brüt vb.) hedeflerinin
            yakalanamaması durumunda oluşacak kayıplar TEDARİKÇİ'ye
            yansıtılacaktır. Belirtilen brüt ölçülerin daha altı
            hedeflenmelidir.
          </li>
          <li>
            <strong>(OFF-TOOL)</strong> Maksimum 2 defa olmak üzere deneme
            üretimleri DNA KALIP hatlarından yapılabilir. Devam eden üretimler
            için <strong>30 €/saat</strong> pres ücreti TEDARİKÇİ'ye fatura
            edilebilir.
          </li>
          <li>
            <strong>(TASARIM)</strong> Tasarım kaynaklı (Kalıp ve/veya Proses
            Tasarımından Kaynaklı) üretim hatalarında ve parça bozukluklarında
            tüm revizyon maliyetleri (kalıp tadilatı, malzeme, işçilik) ve
            zaman kayıpları tasarımı yapan TEDARİKÇİ'ye aittir.
          </li>
          <li>
            <strong>(MAP0 İŞÇİLİK)</strong> DNA KALIP tarafından sağlanan
            malzemelerin veya işlenen parçaların (çelik, döküm vb.) teknik
            resim toleranslarına veya sağlanan veriye uygun olmaması durumunda
            parçalar reddedilecek ve bozulan malzemelerin güncel hammadde
            bedeli ile yeniden işleme/üretim maliyeti TEDARİKÇİ tarafından
            karşılanacaktır.
          </li>
          <li>
            <strong>(FASON İŞLEME)</strong> Fason işleme sırasında işlenen
            malzemenin (çelik, blok, döküm vb.) hatalı işlenmesi, hurdaya
            ayrılması veya ölçü dışına çıkılması durumunda; bozulan malzemenin
            güncel hammadde bedeli ve tedarik süresinden kaynaklanan gecikme
            cezaları TEDARİKÇİ'den tahsil edilecektir.
          </li>
        </ul>
      </div>

      <div className="contract-subsection">
        <h4>3.2 DNA Kalıp Tarafından Sağlanacaklar (Müşteri Desteği)</h4>
        <div className="contract-checkbox-grid">
          {DNA_SUPPORT_ITEMS.map(([name, label]) => (
            <CheckboxField
              key={name}
              name={name}
              checked={form[name]}
              onChange={onChange}
              label={label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeliveryDocumentsSection({ form, onChange }) {
  return (
    <section className="contract-document-section">
      <h3>Madde 4: Teslimde İstenen Dokümanlar</h3>
      <div className="contract-checkbox-grid">
        {DELIVERY_DOCUMENTS.map(([name, label]) => (
          <CheckboxField
            key={name}
            name={name}
            checked={form[name]}
            onChange={onChange}
            label={label}
          />
        ))}
      </div>
    </section>
  );
}

function DeliveryPlanSection({ form, onChange, title, rows, onNestedChange }) {
  return (
    <section className="contract-document-section">
      <h3>{title}</h3>
      <div className="contract-plan-table">
        <div className="contract-plan-table-header">İşlem Adımı</div>
        <div className="contract-plan-table-header">
          {form.financeTab === "tedarikci"
            ? "Planlanan Teslim Tarihi"
            : "Planlanan Tarih"}
        </div>

        {rows.map(([name, label]) => (
          <div className="contract-plan-table-row" key={name}>
            <span>{label}</span>
            {form.financeTab === "tedarikci" && name === "designDeliveryDate" ? (
              <div className="contract-mold-subfields">
                {getMoldIndexes(form.moldCount).map((moldIndex) => (
                  <label key={moldIndex}>
                    <span>{moldIndex + 1}. Kalıp:</span>
                    <input
                      type="date"
                      value={form.moldDesignDates?.[moldIndex] || ""}
                      onChange={(event) =>
                        onNestedChange(
                          "moldDesignDates",
                          moldIndex,
                          event.target.value,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="date"
                name={name}
                value={form[name]}
                onChange={onChange}
              />
            )}
          </div>
        ))}
      </div>
      <p>
        * Gecikme durumunda sözleşmedeki cezai şartlar uygulanacaktır.
      </p>
    </section>
  );
}

function SupplierPaymentTermsSection({ form, onChange, onNestedChange }) {
  const totalInWords = formatAmountInWords(form.totalAmount, form.currency);

  return (
    <section className="contract-document-section">
      <h3>Madde 6: Ticari Şartlar ve Ödeme Planı</h3>
      <div className="contract-document-amount-grid">
        <EditableField
          label="Toplam Anlaşma Bedeli"
          name="totalAmount"
          type="number"
          min="0"
          step="0.01"
          value={form.totalAmount}
          onChange={onChange}
          required
        />

        <label>
          <span>Para Birimi</span>
          <select
            name="currency"
            value={form.currency}
            onChange={onChange}
            required
          >
            <option value="TRY">TRY</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          <span>Kur Tipi</span>
          <select
            name="exchangeRateType"
            value={form.exchangeRateType}
            onChange={onChange}
          >
            <option value="">Seçilmedi</option>
            <option value="fixed">Sabit Kur</option>
            <option value="current">Güncel Kur</option>
          </select>
        </label>

        <EditableField
          label="Sabit Kur"
          name="fixedExchangeRate"
          type="number"
          min="0"
          step="0.0001"
          value={form.fixedExchangeRate}
          onChange={onChange}
          disabled={form.exchangeRateType !== "fixed"}
        />
      </div>

      {totalInWords && (
        <p className="contract-amount-in-words">{totalInWords} + KDV</p>
      )}

      <p>
        <strong>Teminat Çeki (1. ve 2. seçenek için):</strong> TEDARİKÇİ firma,
        toplam tutarın %50'si kadar meblağı, proje sonunda geri almak kaydı ile
        DNA KALIP'a teminat çeki olarak verecektir.
      </p>

      <div className="contract-payment-options">
        <SupplierPaymentOption
          optionName="supplierPaymentOption1"
          checked={form.supplierPaymentOption1}
          onChange={onChange}
          title="1. SEÇENEK"
          description="(OFF-TOOL Anlaşmalarda Yapılacak Olan Ödeme Planı)"
          rows={[
            ["%40", "supplierOpt1Amount40", "Kalıp tasarımı onayı ve döküm/çelik siparişi sonrası, (+60 GÜN)"],
            ["%20", "supplierOpt1Amount20a", "İlk numune (T0) basımı ve CMM raporu tesliminde, (+60 GÜN)"],
            ["%20", "supplierOpt1Amount20b", "%90 Ölçüm yeterliliğinde OFF-TOOL numune tesliminde, (+60 GÜN)"],
            ["%20", "supplierOpt1Amount20c", "Kalıbın DNA KALIP sahasında seri üretim onayı sonrasında ödenecektir. (+60 GÜN)"],
          ]}
          form={form}
          onNestedChange={onNestedChange}
        />
        <SupplierPaymentOption
          optionName="supplierPaymentOption2"
          checked={form.supplierPaymentOption2}
          onChange={onChange}
          title="2. SEÇENEK"
          description="(Tasarım ve MAP0 İşçilik Anlaşmalarında Yapılacak Olan Ödeme Planı)"
          rows={[
            ["%60", "supplierOpt2Amount60", "Kalıp tasarımı onayı ve döküm/çelik malzemenin inmesi sonrasında, (+60 GÜN)"],
            ["%40", "supplierOpt2Amount40", "Kalıbın DNA KALIP sahasına teslimi ve kalite onayı sonrasında. (+60 GÜN)"],
          ]}
          form={form}
          onNestedChange={onNestedChange}
        />
        <SupplierPaymentOption
          optionName="supplierPaymentOption3"
          checked={form.supplierPaymentOption3}
          onChange={onChange}
          title="3. SEÇENEK"
          description="(Proses-Kalıp Tasarımı Anlaşmalarında Yapılacak Olan Ödeme Planı)"
          rows={[
            ["%100", "supplierOpt3Amount100", "Kalıp tasarımının tamamlanması ve DNA KALIP onayı sonrasında, (+60 GÜN)"],
          ]}
          form={form}
          onNestedChange={onNestedChange}
        />
        <SupplierPaymentOption
          optionName="supplierPaymentOption4"
          checked={form.supplierPaymentOption4}
          onChange={onChange}
          title="4. SEÇENEK"
          description="(MAP0 İşçilik Anlaşmalarında Yapılacak Olan Ödeme Planı)"
          rows={[
            ["%100", "supplierOpt4Amount100", "Kalıbın montajlı teslimi ve kalite onayları sonrasında. (+60 GÜN)"],
          ]}
          form={form}
          onNestedChange={onNestedChange}
        />
        <SupplierPaymentOption
          optionName="supplierPaymentOption5"
          checked={form.supplierPaymentOption5}
          onChange={onChange}
          title="5. SEÇENEK"
          description="(Fason İşleme Anlaşmalarında Yapılacak Olan Ödeme Planı)"
          rows={[
            ["%100", "supplierOpt5Amount100", "Parça tesliminde, (+60 GÜN)"],
          ]}
          form={form}
          onNestedChange={onNestedChange}
        />
      </div>
    </section>
  );
}

function SupplierPaymentOption({
  optionName,
  checked,
  onChange,
  title,
  description,
  rows,
  form,
  onNestedChange,
}) {
  return (
    <div className="contract-payment-option">
      <CheckboxField
        name={optionName}
        checked={checked}
        onChange={onChange}
        boldText={title}
        label={description}
      />
      <table className="contract-payment-table">
        <thead>
          <tr>
            <th>Oran</th>
            <th>Tutar</th>
            <th>Açıklama / Şart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([rate, amountName, condition], rowIndex) => (
            <tr key={`${optionName}-${rate}-${amountName}`}>
              <td>{rate}</td>
              <td>
                <input
                  name={amountName}
                  value={form[amountName]}
                  onChange={onChange}
                />
                {checked && rowIndex === 0 && (
                  <div className="contract-mold-subfields payment">
                    {getMoldIndexes(form.moldCount).map((moldIndex) => {
                      const fieldKey = `${optionName}_${moldIndex}`;

                      return (
                        <label key={fieldKey}>
                          <span>{moldIndex + 1}. Kalıp:</span>
                          <input
                            value={form.moldAmounts?.[fieldKey] || ""}
                            onChange={(event) =>
                              onNestedChange(
                                "moldAmounts",
                                fieldKey,
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </td>
              <td>{condition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerPaymentTermsSection({ form, onChange }) {
  const rows = CUSTOMER_PAYMENT_FIELDS.map(
    ([rateField, conditionField, dueDaysField], index) => [
      rateField,
      `customerPaymentAmount${index + 1}`,
      conditionField,
      dueDaysField,
    ],
  ).filter(([rateName, , conditionName, dueName], index) => {
    if (form.contractType === "OFT") return true;
    if (index === 0) return true;

    return Boolean(form[rateName] || form[conditionName] || form[dueName]);
  });
  const totalRate = rows.reduce(
    (sum, [rateName]) => sum + (Number(form[rateName]) || 0),
    0,
  );
  const totalInWords = formatAmountInWords(form.totalAmount, form.currency);

  return (
    <section className="contract-document-section">
      <h3>Madde 4: Ticari Şartlar ve Ödeme Planı</h3>
      <div className="contract-document-amount-grid">
        <EditableField
          label="Toplam Satış Bedeli"
          name="totalAmount"
          type="number"
          min="0"
          step="0.01"
          value={form.totalAmount}
          onChange={onChange}
          required
        />

        <label>
          <span>Para Birimi</span>
          <select
            name="currency"
            value={form.currency}
            onChange={onChange}
            required
          >
            <option value="TRY">TRY</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          <span>Kur Tipi</span>
          <select
            name="exchangeRateType"
            value={form.exchangeRateType}
            onChange={onChange}
          >
            <option value="">Seçilmedi</option>
            <option value="fixed">Sabit Kur</option>
            <option value="current">Güncel Kur</option>
          </select>
        </label>

        <EditableField
          label="Sabit Kur"
          name="fixedExchangeRate"
          type="number"
          min="0"
          step="0.0001"
          value={form.fixedExchangeRate}
          onChange={onChange}
          disabled={form.exchangeRateType !== "fixed"}
        />
      </div>

      {totalInWords && (
        <p className="contract-amount-in-words">{totalInWords} + KDV</p>
      )}

      <div className="contract-payment-title-row">
        <strong>Hakediş ve Ödeme Planı</strong>
        <span className={totalRate === 100 ? "valid" : "invalid"}>
          Toplam Oran: %{totalRate}
          {totalRate !== 100 && " (HATA: %100 OLMALI)"}
        </span>
      </div>
      <table className="contract-payment-table">
        <thead>
          <tr>
            <th>Oran (%)</th>
            <th>Tutar</th>
            <th>Hakediş Şartı / Aşaması</th>
            <th>Vade (Gün)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([rateName, , conditionName, dueName]) => (
            <tr key={rateName}>
              <td>
                <input
                  name={rateName}
                  value={form[rateName]}
                  onChange={onChange}
                />
              </td>
              <td className="contract-calculated-amount">
                {calculatePaymentAmount(
                  form.totalAmount,
                  form[rateName],
                  form.currency,
                )}
              </td>
              <td>
                <input
                  name={conditionName}
                  value={form[conditionName]}
                  onChange={onChange}
                />
              </td>
              <td>
                <input
                  name={dueName}
                  value={form[dueName]}
                  onChange={onChange}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CustomerSignatureSection({ form }) {
  return (
    <div className="contract-customer-signatures">
      <div>
        <h4>SATICI</h4>
        <strong>DNA KALIP</strong>
        <p>(Kaşe / İmza)</p>
      </div>
      <div>
        <h4>ALICI</h4>
        <strong>{form.companyName || "_____________________"}</strong>
        <p>(Kaşe / İmza)</p>
      </div>
    </div>
  );
}

function FinalTermsSection({ form, onChange }) {
  return (
    <>
      <section className="contract-document-section">
        <h3>Madde 7: Garanti Şartları</h3>
        <ol className="contract-ordered-list">
          <li>
            <strong>Baskı Garantisi:</strong> İmal edilen kalıp/aparat,
            1.000.000 baskı/parça üretimi boyunca TEDARİKÇİ'nin garantisi
            altındadır.
          </li>
          <li>
            Garanti süresi veya baskı adedi dolmadan önce, tasarım veya imalat
            hatasından kaynaklanan hasarlar TEDARİKÇİ tarafından bedelsiz ve
            ivedilikle giderilecektir.
          </li>
        </ol>
      </section>

      <section className="contract-document-section">
        <h3>Madde 8: Cezai Şartlar ve Fesih</h3>
        <ol className="contract-ordered-list">
          <li>
            <strong>Gecikme Cezası:</strong> TEDARİKÇİ; planlanan terminleri
            geciktirdiği takdirde, haftalık %5 oranında cezai şart faturası
            kesilecektir.
          </li>
          <li>
            <strong>Yeniden İmalat (OFF-TOOL MAP0):</strong> Kalıbın, nihai
            müşteri şartnamelerine ve istenen hedeflere uygun olarak
            üretilememesi durumunda yaptırılacak yeni kalıbın maliyeti tamamen
            TEDARİKÇİ tarafından karşılanacaktır.
          </li>
          <li>
            <strong>Fesih:</strong> Gecikmelerin 2 (iki) haftayı aşması
            durumunda DNA KALIP sözleşmeyi tek taraflı feshetme hakkına
            sahiptir.
          </li>
        </ol>
      </section>

      <section className="contract-document-section">
        <h3>Madde 9: Gizlilik ve Fikri Mülkiyet</h3>
        <p>
          Tüm tasarımların, verilerin ve kalıpların mülkiyeti ile telif hakları
          tamamen DNA KALIP'a aittir. TEDARİKÇİ bu projeye ait hiçbir veriyi
          üçüncü şahıslarla paylaşamaz.
        </p>
      </section>

      <section className="contract-document-section">
        <h3>Madde 10: Ekler</h3>
        <div className="contract-checkbox-grid">
          {ANNEX_ITEMS.map(([name, label]) => (
            <CheckboxField
              key={name}
              name={name}
              checked={form[name]}
              onChange={onChange}
              label={label}
            />
          ))}
        </div>
      </section>

      <section className="contract-document-section">
        <h3>Madde 11: Uyuşmazlıkların Çözümü</h3>
        <p>
          İşbu sözleşmenin yorumlanmasından veya uygulanmasından doğacak her
          türlü ihtilafta Bursa Mahkemeleri ve İcra Daireleri yetkilidir.
        </p>
      </section>

      <div className="contract-final-signature-block">
        <p>
          İşbu 11 (On Bir) ana madde ve
          <input
            name="pageCount"
            value={form.pageCount}
            onChange={onChange}
            placeholder="4"
          />
          sayfadan ibaret olan bu sözleşme; taraflarca okunup tüm şartlarıyla
          kabul edilerek
          <input
            type="date"
            name="signatureDate"
            value={form.signatureDate}
            onChange={onChange}
          />
          tarihinde <strong>2 (iki) asıl nüsha</strong> halinde tanzim ve imza
          edilmiş olup, nüshalardan biri Müşteri'de (DNA KALIP), diğeri ise
          TEDARİKÇİ'de kalacak şekilde taraflarca karşılıklı olarak teslim
          alınmıştır.
        </p>
        <div className="contract-final-signatures">
          <div>
            <h4>DNA KALIP</h4>
            <p>(Kaşe / İmza)</p>
            <label>
              <strong>Yetkili:</strong>
              <input
                name="supplierSignatureName"
                value={form.supplierSignatureName}
                onChange={onChange}
              />
            </label>
            <label>
              <strong>Tarih:</strong>
              <input
                type="date"
                name="signatureDate"
                value={form.signatureDate}
                onChange={onChange}
              />
            </label>
          </div>
          <div>
            <h4>TEDARİKÇİ FİRMA</h4>
            <p>(Kaşe / İmza)</p>
            <label>
              <strong>Yetkili:</strong>
              <input
                name="customerSignatureName"
                value={form.customerSignatureName}
                onChange={onChange}
              />
            </label>
            <label>
              <strong>Tarih:</strong>
              <input type="date" value={form.signatureDate} readOnly />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}

function CheckboxField({ name, checked, onChange, label, boldText }) {
  return (
    <label className="contract-checkbox-field">
      <input
        type="checkbox"
        name={name}
        checked={Boolean(checked)}
        onChange={onChange}
      />
      <span>
        {boldText && <strong>{boldText}: </strong>}
        {label}
      </span>
    </label>
  );
}

function EditableField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  ...inputProps
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        {...inputProps}
      />
    </label>
  );
}

function ContractDetail({ contract, onPreview, onEdit }) {
  return (
    <div className="contract-detail">
      <div className="contract-detail-actions">
        <button type="button" className="contracts-secondary-btn" onClick={onEdit}>
          Düzenle
        </button>
        <button type="button" className="contracts-primary-btn" onClick={onPreview}>
          Sözleşme Önizle
        </button>
      </div>

      <div className="contract-detail-section">
        <h3>Genel Bilgiler</h3>
        <div className="contract-detail-grid">
          <DetailField label="Sözleşme No" value={contract.contractNumber} />
          <DetailField label="Tür" value={formatFinanceTab(contract.financeTab)} />
          <DetailField label="Firma" value={contract.company?.name} />
          <DetailField label="Tarih" value={contract.contractDate} />
          <DetailField label="İş Emri" value={contract.workOrderNumber} />
          <DetailField label="Referans No" value={contract.referenceNumber} />
          <DetailField label="Proje No" value={contract.projectNumber} />
          <DetailField label="Parça" value={contract.partName} />
          <DetailField label="Kalıp Sayısı" value={contract.moldCount} />
          <DetailField
            label="Sözleşme Bedeli"
            value={formatMoney(contract.totalAmount, contract.currency)}
          />
        </div>
      </div>

      <div className="contract-detail-section">
        <h3>Firma Bilgileri</h3>
        <div className="contract-detail-grid">
          <DetailField label="Firma Türü" value={contract.company?.companyType} />
          <DetailField label="Vergi No" value={contract.company?.taxNumber} />
          <DetailField label="E-posta" value={contract.company?.email} />
          <DetailField label="Telefon" value={contract.company?.phone} />
        </div>
      </div>

      <div className="contract-detail-section">
        <h3>Hakedişler</h3>
        <div className="contract-milestones">
          {contract.milestones.map((milestone) => (
            <div key={milestone.id} className="contract-milestone-card">
              <header>
                <strong>{milestone.condition || "Hakediş"}</strong>
                <span>{formatMoney(milestone.amount, contract.currency)}</span>
              </header>
              <p>Takip anahtarı: {milestone.trackingKey}</p>
              <p>Oran: %{currencyFormatter.format(milestone.rate ?? 0)}</p>
              <p>Vade: {milestone.dueDays} gün</p>
              <p>
                Durum:{" "}
                {milestone.paymentTracking?.status === "paid"
                  ? "Ödendi"
                  : "Bekliyor"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="contract-detail-field">
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </div>
  );
}

export default ContractsPage;
