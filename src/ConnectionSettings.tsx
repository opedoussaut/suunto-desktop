import { FormEvent, useState } from 'react';
import type { Connections } from './types';

interface Props {
  open: boolean;
  connections: Connections;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface CredentialsForm {
  stravaClientId: string;
  stravaClientSecret: string;
  suuntoClientId: string;
  suuntoClientSecret: string;
  suuntoSubscriptionKey: string;
}

const emptyForm: CredentialsForm = {
  stravaClientId: '',
  stravaClientSecret: '',
  suuntoClientId: '',
  suuntoClientSecret: '',
  suuntoSubscriptionKey: '',
};

export function ConnectionSettings({ open, connections, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CredentialsForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  if (!open) return null;

  function patch(field: keyof CredentialsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const patchBody = Object.fromEntries(
      Object.entries(form)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => Boolean(value)),
    );

    if (!Object.keys(patchBody).length) {
      setMessage('Enter at least one value to save. Existing stored credentials are unchanged.');
      return;
    }

    setSaving(true);
    setMessage(undefined);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save credentials.');
      setForm(emptyForm);
      setMessage('Credentials saved locally on this PC.');
      await onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const storedHint = 'Stored value exists — leave blank to keep it';

  return (
    <div className="connections-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="connections-modal" role="dialog" aria-modal="true" aria-labelledby="connections-title">
        <div className="connections-modal-header">
          <div>
            <p className="eyebrow">ACCOUNT CONNECTIONS</p>
            <h2 id="connections-title">Connections & credentials</h2>
            <p>Enter everything once. Secrets stay in <code>.suunto-desktop</code> on this PC and are never committed to Git.</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close connection settings">×</button>
        </div>

        <form onSubmit={(event) => void submit(event)}>
          <div className="credentials-grid">
            <fieldset className="credential-section">
              <legend><span className="provider-mark strava-mark">S</span><span>Strava</span><small>{connections.strava.configured ? 'Configured' : 'Not configured'}</small></legend>
              <label>
                Client ID
                <input
                  type="text"
                  autoComplete="off"
                  value={form.stravaClientId}
                  onChange={(event) => patch('stravaClientId', event.target.value)}
                  placeholder={connections.strava.configured ? storedHint : 'e.g. 123456'}
                />
              </label>
              <label>
                Client Secret
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.stravaClientSecret}
                  onChange={(event) => patch('stravaClientSecret', event.target.value)}
                  placeholder={connections.strava.configured ? storedHint : 'Paste from Strava API settings'}
                />
              </label>
              <div className="credential-help">
                Callback domain: <strong>127.0.0.1</strong><br />
                Callback URL: <code>http://127.0.0.1:1420/api/strava/callback</code>
              </div>
            </fieldset>

            <fieldset className="credential-section">
              <legend><span className="provider-mark suunto-mark">S</span><span>Suunto Cloud</span><small>{connections.suunto.configured ? 'Configured' : 'Not configured'}</small></legend>
              <label>
                Partner Client ID
                <input
                  type="text"
                  autoComplete="off"
                  value={form.suuntoClientId}
                  onChange={(event) => patch('suuntoClientId', event.target.value)}
                  placeholder={connections.suunto.configured ? storedHint : 'Suunto partner Client ID'}
                />
              </label>
              <label>
                Partner Client Secret
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.suuntoClientSecret}
                  onChange={(event) => patch('suuntoClientSecret', event.target.value)}
                  placeholder={connections.suunto.configured ? storedHint : 'Suunto partner Client Secret'}
                />
              </label>
              <label>
                Ocp-Apim Subscription Key
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.suuntoSubscriptionKey}
                  onChange={(event) => patch('suuntoSubscriptionKey', event.target.value)}
                  placeholder={connections.suunto.configured ? storedHint : 'Suunto API subscription key'}
                />
              </label>
              <div className="credential-help">
                Callback URL: <code>http://127.0.0.1:1420/api/suunto/callback</code>
              </div>
            </fieldset>
          </div>

          {message && <div className="credential-message" role="status">{message}</div>}

          <div className="connections-modal-actions">
            <span>Blank fields never erase existing stored credentials.</span>
            <div>
              <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save all credentials'}</button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
