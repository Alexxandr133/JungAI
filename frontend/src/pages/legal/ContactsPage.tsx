import { Link } from 'react-router-dom';
import { GuestNavbar } from '../../components/GuestNavbar';
import { SiteFooter } from '../../components/SiteFooter';
import { OPERATOR_INFO } from '../../content/operatorInfo';
import './LegalDocumentPage.css';

export default function ContactsPage() {
  return (
    <div className="legal-doc-page">
      <GuestNavbar />
      <main className="legal-doc-main">
        <div style={{ marginBottom: 16 }}>
          <Link to="/" className="small" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← На главную
          </Link>
        </div>
        <div className="legal-doc-card">
          <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>Контакты</h1>
          <p className="small" style={{ color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.55 }}>
            Оператор платформы JungAI. По вопросам работы сервиса, персональных данных и юридических обращений.
          </p>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Оператор (ИП)</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {[
                  ['Наименование', OPERATOR_INFO.legalName],
                  ['Сокращённо', OPERATOR_INFO.shortName],
                  ['ИНН', OPERATOR_INFO.inn],
                  ['ОГРНИП', OPERATOR_INFO.ogrnip],
                  ['Дата регистрации ИП', OPERATOR_INFO.ipRegisteredAt],
                  ['Регион регистрации', OPERATOR_INFO.region],
                  ['Реестр операторов ПДн (Роскомнадзор)', `№ ${OPERATOR_INFO.rknRegistryNumber}`],
                  ['Ответственный за обработку ПДн', OPERATOR_INFO.responsiblePerson],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <th
                      style={{
                        textAlign: 'left',
                        verticalAlign: 'top',
                        padding: '10px 12px',
                        width: '38%',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </th>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Связь</h2>
            <p style={{ margin: '0 0 8px' }}>
              E-mail:{' '}
              <a href={`mailto:${OPERATOR_INFO.email}`} style={{ color: 'var(--primary)' }}>
                {OPERATOR_INFO.email}
              </a>
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Сайт:{' '}
              <a href={OPERATOR_INFO.siteUrl} style={{ color: 'var(--primary)' }}>
                {OPERATOR_INFO.siteLabel}
              </a>
            </p>
            <p className="small" style={{ color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
              Обращения по персональным данным: укажите в теме письма «JungAI / Персональные данные». Срок ответа — до
              30 дней в соответствии с 152-ФЗ.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Банковские реквизиты</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {[
                  ['Банк', OPERATOR_INFO.bank.name],
                  ['Расчётный счёт', OPERATOR_INFO.bank.account],
                  ['БИК', OPERATOR_INFO.bank.bik],
                  ['Корр. счёт', OPERATOR_INFO.bank.corrAccount],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        width: '38%',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </th>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Документы</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              <li>
                <Link to="/terms">Пользовательское соглашение</Link>
              </li>
              <li>
                <Link to="/privacy">Политика конфиденциальности</Link>
              </li>
              <li>
                <Link to="/personal-data-consent">Согласие на обработку персональных данных</Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
