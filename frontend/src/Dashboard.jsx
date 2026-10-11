import { useCallback, useEffect, useState } from 'react'
import InteractiveMap from './InteractiveMap'
import {
  getReports,
  createReport,
  updateReportStatus,
  logoutAccount,
  clearSession,
} from './api'

function Dashboard({ user, onSignOut }) {
  const isAdmin = user?.role === 'admin'

  const [emergency, setEmergency] = useState(false)
  const [reports, setReports] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [showReportForm, setShowReportForm] = useState(false)
  const [adminMode, setAdminMode] = useState(false)

  const [form, setForm] = useState({
    type: 'pothole',
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    severity: 'medium',
  })

  const loadReports = useCallback(async ({ showError = true } = {}) => {
    setLoading(true)

    try {
      const data = await getReports()
      setReports(Array.isArray(data) ? data : [])
      return true
    } catch (error) {
      if (showError) {
        setMessage(
          error.message ||
          'Cannot load road reports. Please check your login session.'
        )
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  function updateForm(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function closeReportForm() {
    if (submitting) return
    setShowReportForm(false)
  }

  async function submitReport(event) {
    event.preventDefault()
    setMessage('')

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)

    if (
      form.latitude.trim() === '' ||
      form.longitude.trim() === '' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setMessage('Enter valid latitude and longitude values.')
      return
    }

    if (!form.title.trim()) {
      setMessage('Please enter a title for the road problem.')
      return
    }

    setSubmitting(true)

    try {
      await createReport({
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        latitude,
        longitude,
        severity: form.severity,
      })

      setForm({
        type: 'pothole',
        title: '',
        description: '',
        latitude: '',
        longitude: '',
        severity: 'medium',
      })

      setShowReportForm(false)

      const refreshed = await loadReports({ showError: false })

      const successMessage = refreshed
  ? 'Report submitted successfully! It is awaiting administrator verification.'
  : 'Report submitted successfully, but the report list could not refresh.'

setMessage(successMessage)
window.alert(successMessage)

    } catch (error) {
      setMessage(error.message || 'Could not submit the report.')
    } finally {
      setSubmitting(false)
    }
  }

  async function changeStatus(id, status) {
    if (!isAdmin) {
      setMessage('Only administrator accounts can verify reports.')
      return
    }

    setUpdatingReportId(id)
    setMessage('')

    try {
      await updateReportStatus(id, status)

      const refreshed = await loadReports({ showError: false })

      setMessage(
        refreshed
          ? `Report #${id} updated to ${status}.`
          : `Report #${id} was updated, but the list could not refresh.`
      )
    } catch (error) {
      setMessage(error.message || 'Could not update the report.')
    } finally {
      setUpdatingReportId(null)
    }
  }

  async function signOut() {
    try {
      await logoutAccount()
    } catch {
      // Clear the local session even if the backend logout request fails.
    }

    clearSession()
    onSignOut?.()
  }

  function displayStatus(status) {
    if (status === 'unverified') return 'Awaiting verification'
    if (!status) return 'Unknown'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  useEffect(() => {
    if (!showReportForm) return

    function handleEscape(event) {
      if (event.key === 'Escape' && !submitting) {
        setShowReportForm(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showReportForm, submitting])

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="login-brand" href="/">
          <span className="brand-symbol">R</span>
          <span>
            RoadSense <b>AI</b>
          </span>
        </a>

        <div className="dashboard-header-right">
          <span className="dashboard-status">
            {isAdmin
              ? 'ADMINISTRATOR WORKSPACE'
              : 'USER SAFETY WORKSPACE'}
          </span>

          <button
            type="button"
            className="dashboard-logout"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="dashboard-welcome">
        <div>
          <span className="intro-label">
            {isAdmin
              ? 'REPORT REVIEW & ROAD SAFETY'
              : 'YOUR JOURNEY, YOUR SAFETY'}
          </span>

          <h1>
            Move smarter.
            <br />
            <span>Arrive safer.</span>
          </h1>

          <p>
            Signed in as {user?.name || user?.email || 'user'} ·{' '}
            {isAdmin ? 'Administrator' : 'Normal user'} account
          </p>
        </div>

        <button
          type="button"
          className="emergency-button"
          onClick={() => {
            setEmergency((previous) => !previous)
            setMessage('')
          }}
        >
          <span>✚</span>{' '}
          {emergency ? 'Exit emergency mode' : 'Emergency mode'}
        </button>
      </section>

      {emergency && (
        <section className="emergency-notice">
          <strong>Emergency mode enabled</strong>
          <p>
            Find nearby mapped services such as hospitals, police stations
            and pharmacies. This demo does not contact or dispatch emergency
            services. In a real emergency in India, call 112.
          </p>
        </section>
      )}

      {message && (
        <div
          role="status"
          className="dashboard-panel dashboard-message"
        >
          {message}
          <button
            type="button"
            className="message-close"
            aria-label="Dismiss message"
            onClick={() => setMessage('')}
          >
            ×
          </button>
        </div>
      )}

      <section className="dashboard-grid">
        <InteractiveMap
          emergencyActive={emergency}
          onEmergencyChange={setEmergency}
        />

        <article className="dashboard-panel feature-panel">
          <span className="feature-symbol">＋</span>

          <div>
            <span className="card-kicker">CONTRIBUTE</span>
            <h2>Report a road problem</h2>
            <p>
              Submit potholes, waterlogging or damaged-road reports
              to the database.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMessage('')
              setShowReportForm(true)
            }}
          >
            Report a hazard <span>→</span>
          </button>
        </article>

        {isAdmin && (
          <article className="dashboard-panel feature-panel admin-panel">
            <span className="feature-symbol">◇</span>

            <div>
              <span className="card-kicker">
                ADMIN ONLY · REPORT MANAGEMENT
              </span>
              <h2>Report verification</h2>
              <p>
                Review submitted reports and update their verification status.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setAdminMode((previous) => !previous)}
            >
              {adminMode ? 'Hide reports' : 'Review reports'} <span>→</span>
            </button>

            {adminMode && (
              <div className="report-list">
                {loading ? (
                  <p>Loading reports...</p>
                ) : reports.length === 0 ? (
                  <p>No submitted reports yet.</p>
                ) : (
                  reports.map((report) => (
                    <div className="report-item" key={report.id}>
                      <h3>
                        #{report.id} — {report.title}
                      </h3>

                      <p>
                        {report.type} · {report.severity} severity
                      </p>

                      {report.description && <p>{report.description}</p>}

                      <p>
                        Coordinates: {report.latitude}, {report.longitude}
                      </p>

                      <p>
                        Status: {displayStatus(report.verificationStatus)}
                      </p>

                      <p>
                        Reported:{' '}
                        {report.reportedAt
                          ? new Date(report.reportedAt).toLocaleString()
                          : 'Date unavailable'}
                      </p>

                      <div className="report-actions">
                        <button
                          type="button"
                          disabled={
                            updatingReportId === report.id ||
                            report.verificationStatus === 'verified'
                          }
                          onClick={() => changeStatus(report.id, 'verified')}
                        >
                          {updatingReportId === report.id
                            ? 'Updating...'
                            : 'Verify'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            updatingReportId === report.id ||
                            report.verificationStatus === 'rejected'
                          }
                          onClick={() => changeStatus(report.id, 'rejected')}
                        >
                          Reject
                        </button>

                        <button
                          type="button"
                          disabled={
                            updatingReportId === report.id ||
                            report.verificationStatus === 'resolved'
                          }
                          onClick={() => changeStatus(report.id, 'resolved')}
                        >
                          Mark resolved
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => loadReports()}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh reports'}
                </button>
              </div>
            )}
          </article>
        )}
      </section>

      <footer className="dashboard-footer">
        <span>© 2026 RoadSense AI</span>
        <span>SAFER JOURNEYS START WITH BETTER INFORMATION</span>
      </footer>

      {showReportForm && (
        <div
          className="report-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              closeReportForm()
            }
          }}
        >
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
          >
            <header className="report-modal-header">
              <div>
                <span className="card-kicker">
                  ROAD SAFETY CONTRIBUTION
                </span>
                <h2 id="report-modal-title">Report a road problem</h2>
                <p>
                  Provide the location and details so the problem can be reviewed.
                </p>
              </div>

              <button
                type="button"
                className="report-modal-close"
                aria-label="Close report form"
                onClick={closeReportForm}
                disabled={submitting}
              >
                ×
              </button>
            </header>

            <form
              onSubmit={submitReport}
              className="road-report-form report-modal-form"
            >
              <label>
                Hazard type
                <select
                  name="type"
                  value={form.type}
                  onChange={updateForm}
                  required
                >
                  <option value="pothole">Pothole</option>
                  <option value="waterlogging">Waterlogging</option>
                  <option value="road_damage">Damaged road</option>
                  <option value="accident">Accident-prone area</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                Report title
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="e.g. Large pothole near station"
                />
              </label>

              <label className="report-description-field">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  maxLength={2000}
                  placeholder="Describe the road problem, its size and nearby landmarks."
                  rows={5}
                />
              </label>

              <div className="report-coordinate-fields">
                <label>
                  Latitude
                  <input
                    name="latitude"
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    value={form.latitude}
                    onChange={updateForm}
                    required
                    placeholder="e.g. 22.8721"
                  />
                </label>

                <label>
                  Longitude
                  <input
                    name="longitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={form.longitude}
                    onChange={updateForm}
                    required
                    placeholder="e.g. 88.4169"
                  />
                </label>
              </div>

              <label>
                Severity
                <select
                  name="severity"
                  value={form.severity}
                  onChange={updateForm}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <div className="report-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeReportForm}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  className="login-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting report...' : 'Submit report'}
                  <span>→</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default Dashboard