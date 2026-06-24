import "./FinanceDetail.css";

function FinanceDetail({ selectedRow }) {
  if (!selectedRow) return null;

  return (
    <div className="finance-detail">
      <div className="finance-detail-status">
        <span className={`status-badge ${selectedRow.durum.toLowerCase()}`}>
          {selectedRow.durum}
        </span>
      </div>

      <div className="finance-detail-section">
        <h3>Sözleşme Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Sözleşme No</span>
            <strong>{selectedRow.sozlesmeNo}</strong>
          </div>

          <div>
            <span>Tedarikçi</span>
            <strong>{selectedRow.tedarikci}</strong>
          </div>

          <div>
            <span>İş Emri No</span>
            <strong>{selectedRow.isEmriNo}</strong>
          </div>

          <div>
            <span>Referans No</span>
            <strong>{selectedRow.referansNo}</strong>
          </div>

          <div>
            <span>Sözleşme Bedeli</span>
            <strong>
              {Number(selectedRow.sozlesmeBedeli).toLocaleString("tr-TR")}
            </strong>
          </div>

          <div>
            <span>Para Birimi</span>
            <strong>{selectedRow.paraBirimi}</strong>
          </div>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Hakediş Bilgileri</h3>

        <div className="finance-detail-grid">
          <div>
            <span>Hakediş Oranı</span>
            <strong>%{selectedRow.hakedisOrani}</strong>
          </div>

          <div>
            <span>Tutar</span>
            <strong>{selectedRow.tutar}</strong>
          </div>

          <div>
            <span>Onay Tarihi</span>
            <strong>{selectedRow.onayTarihi || "-"}</strong>
          </div>

          <div>
            <span>Ödeme Tarihi</span>
            <strong>{selectedRow.odemeTarihi || "-"}</strong>
          </div>
        </div>
      </div>

      <div className="finance-detail-section">
        <h3>Hakediş Şartı</h3>

        <p className="finance-detail-note">
          {selectedRow.hakedisSarti}
        </p>
      </div>
      <div className="finance-detail-actions">
            
      {/* <button className="detail-btn primary">
        PDF Görüntüle
      </button>

      <button className="detail-btn secondary">
        Ödeme Geçmişi
      </button>

      <button className="detail-btn secondary">
        Düzenle
      </button> */}
    </div>

  </div>
       
  );
}

export default FinanceDetail;