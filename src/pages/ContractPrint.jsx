import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiPrinter, FiX } from 'react-icons/fi';
import { getContractById } from '../services/contractsApi';
import { getOverflowingContractPageNumbers } from '../services/contractPrint';
import { ContractPreview } from './Contracts';
import './ContractPrint.css';

function waitForPrintAssets() {
  const images = [...document.images].map(image => image.complete
    ? Promise.resolve()
    : new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }));
  return Promise.all([document.fonts?.ready ?? Promise.resolve(), ...images]);
}

export default function ContractPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [error, setError] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [loading, setLoading] = useState(true);
  const printRequested = useRef(false);
  const printPageRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    getContractById(id, { signal: controller.signal })
      .then(setContract)
      .catch(requestError => {
        if (!controller.signal.aborted) {
          setError(requestError.message || 'Sözleşme yüklenemedi.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!contract || printRequested.current) return;
    const previousTitle = document.title;
    document.title = contract.contractNumber || 'DNA Kalıp Sözleşme';
    let active = true;
    waitForPrintAssets().then(() => {
      if (active && !printRequested.current) {
        const overflowingPages = getOverflowingContractPageNumbers(printPageRef.current);
        if (overflowingPages.length > 0) {
          setLayoutError(
            `Sözleşmenin ${overflowingPages.join(', ')}. sayfası A4 sınırını aşıyor. Çıktı oluşturulmadı.`,
          );
          return;
        }
        printRequested.current = true;
        window.setTimeout(() => window.print(), 100);
      }
    });
    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [contract]);

  function printContract() {
    const overflowingPages = getOverflowingContractPageNumbers(printPageRef.current);
    if (overflowingPages.length > 0) {
      setLayoutError(
        `Sözleşmenin ${overflowingPages.join(', ')}. sayfası A4 sınırını aşıyor. Çıktı oluşturulmadı.`,
      );
      return;
    }

    setLayoutError('');
    window.print();
  }

  function closePrintView() {
    window.close();
    window.setTimeout(() => navigate('/contracts', { replace: true }), 100);
  }

  return (
    <main className="contract-print-page" ref={printPageRef}>
      <header className="contract-print-toolbar">
        <div>
          <strong>{contract?.contractNumber || 'Sözleşme çıktısı'}</strong>
          <span>Tüm sözleşme sayfaları A4 olarak hazırlanır.</span>
        </div>
        <div>
          <button type="button" className="contract-print-secondary" onClick={closePrintView}>
            <FiX aria-hidden="true" /> Kapat
          </button>
          <button type="button" className="contract-print-primary" disabled={!contract} onClick={printContract}>
            <FiPrinter aria-hidden="true" /> Yazdır / PDF
          </button>
        </div>
      </header>

      {loading && <div className="contract-print-status" role="status">Sözleşme hazırlanıyor...</div>}
      {!loading && error && <div className="contract-print-status contract-print-status--error" role="alert">{error}</div>}
      {!loading && layoutError && (
        <div className="contract-print-status contract-print-status--error" role="alert">{layoutError}</div>
      )}
      {!loading && contract && <ContractPreview contract={contract} onCancel={closePrintView} />}
    </main>
  );
}
