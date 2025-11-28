import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import AvailabilityTab from '../components/Availability/AvailabilityTab';
import MapTab from '../components/Map/MapTab';
import { useAuth } from '../context/AuthContext';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('availability');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
  });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [recText, setRecText] = useState('');
  const [recPrefs, setRecPrefs] = useState('');
  const [planText, setPlanText] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/${id}`);
      setTrip(data.trip);
      setError('');
      setPlanText(data.trip.planText || '');
      setEditForm({
        name: data.trip.name || '',
        destination: data.trip.destination || '',
        startDate: data.trip.startDate?.slice(0, 10) || '',
        endDate: data.trip.endDate?.slice(0, 10) || '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load trip');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendations = async (e) => {
    e.preventDefault();
    setRecError('');
    setRecLoading(true);
    try {
      const { data } = await api.post(`/trips/${id}/recommendations`, {
        preferences: recPrefs,
      });
      setRecText(data.ideas);
      setPlanText((prev) => (prev ? `${prev}\n\n${data.ideas}` : data.ideas));
    } catch (err) {
      setRecError(err.response?.data?.error || 'Failed to fetch ideas');
      setRecText('');
    } finally {
      setRecLoading(false);
    }
  };

  const handleSavePlan = async () => {
    setPlanSaving(true);
    try {
      const { data } = await api.put(`/trips/${id}/plan`, { planText });
      setPlanText(data.planText || '');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleClearPlan = async () => {
    setPlanSaving(true);
    try {
      await api.delete(`/trips/${id}/plan`);
      setPlanText('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clear plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);
    try {
      const { data } = await api.post(`/trips/${id}/members`, { email: inviteEmail.trim() });
      setTrip(data.trip);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      const { data } = await api.delete(`/trips/${id}/members/${memberId}`);
      setTrip(data.trip);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleEditChange = (e) => {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateDates = () => {
    const start = new Date(editForm.startDate);
    const end = new Date(editForm.endDate);
    if (isNaN(start) || isNaN(end)) return 'Please provide valid dates';
    if (end <= start) return 'End date must be after start date';
    const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (dayCount > 365) return 'Trip length cannot exceed 365 days';
    return null;
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditError('');
    const dateError = validateDates();
    if (dateError) {
      setEditError(dateError);
      return;
    }
    setEditSaving(true);
    try {
      const { data } = await api.put(`/trips/${id}`, {
        name: editForm.name,
        destination: editForm.destination,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
      });
      setTrip(data.trip);
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update trip');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading trip...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{trip.name}</h1>
              <div className="flex flex-wrap gap-4 text-blue-100">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{trip.destination}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>
                    {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span>
                    {trip.members.length} member{trip.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            {trip.owner?._id === user.id && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-white/15 text-white rounded-lg border border-white/30 hover:bg-white/25 transition text-sm"
              >
                Edit Trip
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('availability')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'availability'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Availability
              </div>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'map'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Map & Places
              </div>
            </button>
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {trip.owner?._id === user.id && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Trip</h3>
                <p className="text-sm text-gray-600">Update trip details and dates (max 365 days)</p>
              </div>
              <button
                onClick={() => setEditing(!editing)}
                className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                {editing ? 'Close' : 'Edit'}
              </button>
            </div>
            {editing && (
              <form className="space-y-4" onSubmit={handleEditSave}>
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {editError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trip name</label>
                    <input
                      name="name"
                      value={editForm.name}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                    <input
                      name="destination"
                      value={editForm.destination}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={editForm.startDate}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={editForm.endDate}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setEditError('');
                      setEditForm({
                        name: trip.name || '',
                        destination: trip.destination || '',
                        startDate: trip.startDate?.slice(0, 10) || '',
                        endDate: trip.endDate?.slice(0, 10) || '',
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  End date must be after start date. Trips longer than 365 days are not allowed.
                </p>
              </form>
            )}
          </div>
        )}

        {/* Members + Invite */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Members</h3>
              <p className="text-sm text-gray-600">{trip.members.length} total</p>
            </div>
            {trip.owner?._id === user.id && (
              <form className="flex gap-2" onSubmit={handleInvite}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviteLoading ? 'Adding...' : 'Add'}
                </button>
              </form>
            )}
          </div>
          {inviteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-3 text-sm">
              {inviteError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {trip.members.map((member) => (
              <div key={member._id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{member.name}</div>
                  <div className="text-xs text-gray-600">{member.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {member._id === trip.owner?._id && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Owner</span>
                  )}
                  {trip.owner?._id === user.id && member._id !== trip.owner?._id && (
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Trip Ideas</h3>
              <p className="text-sm text-gray-600">Get quick suggestions near this destination</p>
            </div>
          </div>
          <form onSubmit={handleRecommendations} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Preferences (optional)
              <textarea
                value={recPrefs}
                onChange={(e) => setRecPrefs(e.target.value)}
                rows={3}
                placeholder="e.g., family-friendly, budget eats, nightlife, museums"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={recLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {recLoading ? 'Generating...' : 'Get & Append Ideas'}
              </button>
            </div>
          </form>
          {recError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mt-3 text-sm">
              {recError}
            </div>
          )}
          {recLoading && (
            <div className="mt-2 text-sm text-gray-600">
              Generating itinerary ideas... this may take a few seconds.
            </div>
          )}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 text-sm">Plan</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePlan}
                  disabled={planSaving}
                  className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {planSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleClearPlan}
                  disabled={planSaving}
                  className="px-3 py-2 text-xs text-red-600 hover:text-red-800 rounded-lg"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={planText}
              onChange={(e) => setPlanText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm whitespace-pre-wrap break-words"
              placeholder="Your plan. AI ideas will append when generated."
            />
          </div>
        </div>

        {activeTab === 'availability' && <AvailabilityTab trip={trip} />}
        {activeTab === 'map' && <MapTab trip={trip} />}
      </main>
    </div>
  );
}
