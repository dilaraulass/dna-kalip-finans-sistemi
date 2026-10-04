import { CURRENCIES } from "../../constants/financeConstants";
import { FiRefreshCw } from "react-icons/fi";

function ExchangeRateSettings({
  form,
  error,
  saving,
  fetchingLiveRates,
  onChange,
  onSubmit,
  onFetchLiveRates,
}) {
  return (
    <form className="exchange-rate-settings" onSubmit={onSubmit}>
      <div>
        <h2>Kur Ayarları</h2>
        <p>Finans hesaplarında kullanılan güncel döviz kurlarını yönetin.</p>
      </div>

      <div className="exchange-rate-fields">
        <label>
          <span>TRY</span>
          <input type="number" value="1" disabled />
        </label>

        <label>
          <span>EUR → TRY</span>
          <input
            type="number"
            name={CURRENCIES.eur}
            min="0"
            step="0.000001"
            value={form[CURRENCIES.eur]}
            onChange={onChange}
            required
          />
        </label>

        <label>
          <span>USD → TRY</span>
          <input
            type="number"
            name={CURRENCIES.usd}
            min="0"
            step="0.000001"
            value={form[CURRENCIES.usd]}
            onChange={onChange}
            required
          />
        </label>

        <button
          type="submit"
          className="finance-primary-btn"
          disabled={saving || fetchingLiveRates}
        >
          {saving ? "Kaydediliyor..." : "Kurları Güncelle"}
        </button>

        <button
          type="button"
          className="finance-secondary-btn exchange-live-rate-btn"
          onClick={onFetchLiveRates}
          disabled={saving || fetchingLiveRates}
          title="Güncel TCMB kur verilerini çek"
        >
          <FiRefreshCw aria-hidden="true" />
          {fetchingLiveRates ? "Çekiliyor..." : "Güncel Kuru Çek"}
        </button>
      </div>

      {error && <div className="exchange-rate-error">{error}</div>}
    </form>
  );
}

export default ExchangeRateSettings;
