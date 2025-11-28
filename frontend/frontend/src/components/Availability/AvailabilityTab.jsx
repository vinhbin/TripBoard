import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function AvailabilityTab({ trip }) {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('can'); // can | maybe | cannot
  const [selectedDate, setSelectedDate] = useState(null);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const MAX_DAYS = 90;

  const getCalendarDays = () => {
    const dates = [];
    const start = new Date(trip.startDate);
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(start);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    const end = rawEnd < cappedEnd ? rawEnd : cappedEnd;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const isInTripRange = (date) => {
    const start = new Date(trip.startDate);
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(start);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    const end = rawEnd < cappedEnd ? rawEnd : cappedEnd;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  useEffect(() => {
    fetchAvailabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip._id]);

  const fetchAvailabilities = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/${trip._id}/availability`);
      setAvailabilities(data.availabilities);
    } catch (err) {
      console.error('Failed to fetch availabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (date, newStatus) => {
    setUpdating(true);
    try {
      const isoDate = date.toISOString().split('T')[0];

      if (newStatus === null) {
        await api.delete(`/trips/${trip._id}/availability`, { data: { date: isoDate } });
        setAvailabilities((prev) =>
          prev.filter(
            (a) =>
              !(
                new Date(a.date).toDateString() === date.toDateString() &&
                a.userId._id === user.id
              ),
          ),
        );
        return;
      }

      const { data } = await api.post(`/trips/${trip._id}/availability`, {
        date: isoDate,
        status: newStatus,
      });

      setAvailabilities((prev) => {
        const filtered = prev.filter(
          (a) =>
            !(
              new Date(a.date).toDateString() === date.toDateString() &&
              a.userId._id === user.id
            ),
        );
        return [...filtered, data.availability];
      });
    } catch (err) {
      console.error('Failed to update availability:', err);
      alert('Failed to update availability');
    } finally {
      setUpdating(false);
    }
  };

  const applyRangeStatus = async () => {
    if (!rangeStart || !rangeEnd) {
      alert('Select a start and end date.');
      return;
    }
    if (rangeEnd < rangeStart) {
      alert('End date must be on or after start date.');
      return;
    }
    const dates = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    if (!dates.every(isInTripRange)) {
      alert('All dates must be within the trip range.');
      return;
    }
    if (dates.length > MAX_DAYS) {
      alert(`Range too large. Max ${MAX_DAYS} days.`);
      return;
    }

    setUpdating(true);
    try {
      let updated = [...availabilities];
      for (const date of dates) {
        const isoDate = date.toISOString().split('T')[0];
        if (selectedStatus === null) {
          await api.delete(`/trips/${trip._id}/availability`, { data: { date: isoDate } });
          updated = updated.filter(
            (a) =>
              !(
                new Date(a.date).toDateString() === date.toDateString() &&
                a.userId._id === user.id
              ),
          );
        } else {
          const { data } = await api.post(`/trips/${trip._id}/availability`, {
            date: isoDate,
            status: selectedStatus,
          });
          updated = updated.filter(
            (a) =>
              !(
                new Date(a.date).toDateString() === date.toDateString() &&
                a.userId._id === user.id
              ),
          );
          updated.push(data.availability);
        }
      }
      setAvailabilities(updated);
    } catch (err) {
      console.error('Failed to update availability range:', err);
      alert('Failed to update availability range');
    } finally {
      setUpdating(false);
    }
  };

  const handleDateClick = async (date) => {
    // Click sets the selectedStatus; to clear, user can cycle to null by selecting none in UI if you add that option
    await handleStatusChange(date, selectedStatus);
  };

  const getDatesInRange = () => {
    const dates = [];
    const start = new Date(trip.startDate);
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(start);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    const end = rawEnd < cappedEnd ? rawEnd : cappedEnd;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const getUserStatus = (date) => {
    const availability = availabilities.find(
      (a) =>
        new Date(a.date).toDateString() === date.toDateString() && a.userId._id === user.id,
    );
    return availability?.status || null;
  };

  const getDateScore = (date) => {
    const dateAvails = availabilities.filter(
      (a) => new Date(a.date).toDateString() === date.toDateString(),
    );
    let score = 0;
    dateAvails.forEach((a) => {
      if (a.status === 'can') score += 3;
      else if (a.status === 'maybe') score += 1;
      else if (a.status === 'cannot') score -= 2;
    });
    return score;
  };

  const getDateStatuses = (date) =>
    trip.members.map((member) => {
      const availability = availabilities.find(
        (a) =>
          new Date(a.date).toDateString() === date.toDateString() &&
          a.userId._id === member._id,
      );
      return {
        member,
        status: availability?.status || null,
      };
    });

  const cycleStatus = (currentStatus) => {
    const cycle = [null, 'can', 'maybe', 'cannot'];
    const currentIndex = cycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % cycle.length;
    return cycle[nextIndex];
  };

  const getStatusColor = (status, isInRange) => {
    if (!isInRange) return 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500';
    switch (status) {
      case 'can':
        return 'bg-green-500 text-white';
      case 'maybe':
        return 'bg-yellow-500 text-white';
      case 'cannot':
        return 'bg-red-500 text-white';
      default:
        return 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700';
    }
  };

  const getGroupHeatmapColor = (date) => {
    if (!isInTripRange(date)) return 'bg-gray-100 text-gray-400';
    const score = getDateScore(date);
    const memberCount = trip.members.length || 1;
    const maxScore = memberCount * 3; // all can
    if (score <= 0) return 'bg-red-100 text-red-800 border border-red-200';
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-green-500 text-white';
    if (percentage >= 60) return 'bg-green-400 text-white';
    if (percentage >= 40) return 'bg-yellow-400 text-gray-900';
    if (percentage >= 20) return 'bg-yellow-300 text-gray-900';
    return 'bg-orange-300 text-gray-900';
  };

  const calendarDays = getCalendarDays();
  // top dates
  const tripDates = calendarDays.filter(isInTripRange);
  const rankedDates = tripDates
    .map((date) => ({
      date,
      score: getDateScore(date),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const tripLengthDays =
    Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1;

  // set default selected date once trip loads
  useEffect(() => {
    if (trip?.startDate) {
      setSelectedDate(new Date(trip.startDate));
      setRangeStart(new Date(trip.startDate));
      setRangeEnd(new Date(trip.startDate));
    }
  }, [trip?.startDate]);

  const minDate = new Date(trip.startDate);
  const maxDate = (() => {
    const rawEnd = new Date(trip.endDate);
    const cappedEnd = new Date(minDate);
    cappedEnd.setDate(cappedEnd.getDate() + MAX_DAYS - 1);
    return rawEnd < cappedEnd ? rawEnd : cappedEnd;
  })();

  if (loading) {
    return <div className="text-center py-8">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Instructions & Status selector */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-3">Mark Your Availability</h3>
        <p className="mb-4 opacity-90">Pick a status, then click dates on the calendar.</p>
        {tripLengthDays > MAX_DAYS && (
          <div className="mb-3 text-sm bg-white/15 rounded-md px-3 py-2">
            Trip is {tripLengthDays} days long. Showing the first {MAX_DAYS} days for performance.
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'can', label: 'Can Go', icon: '✓', color: 'bg-green-600' },
            { key: 'maybe', label: 'Maybe', icon: '?', color: 'bg-yellow-500' },
            { key: 'cannot', label: 'Cannot', icon: '✗', color: 'bg-red-600' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedStatus(opt.key)}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${selectedStatus === opt.key ? `${opt.color} text-white ring-2 ring-white` : 'bg-white/20 text-white hover:bg-white/30'
                }`}
            >
              <span className="text-xl">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top dates */}
      <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md p-6 border border-transparent dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">🏆 Best Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rankedDates.map(({ date, score }, index) => (
            <div
              key={date.toISOString()}
              className="border-2 border-blue-200 rounded-lg p-4 text-center bg-blue-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            >
              <div className="text-sm font-semibold text-blue-600 mb-1 flex items-center justify-center gap-1">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
                <span>#{index + 1}</span>
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-sm text-gray-600">
                {date.toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-600">{score} pts</div>
            </div>
          ))}
        </div>
      </div>

      {/* Simple date picker & action */}
      <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md p-6 space-y-4 border border-transparent dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Pick a Date</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block">Date (within trip)</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              min={minDate.toISOString().split('T')[0]}
              max={maxDate.toISOString().split('T')[0]}
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
            />
            <p className="text-xs text-gray-500">
              Trip window: {minDate.toLocaleDateString()} → {maxDate.toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-slate-200">Set status</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'can', label: 'Can Go', color: 'bg-green-500' },
                { key: 'maybe', label: 'Maybe', color: 'bg-yellow-500' },
                { key: 'cannot', label: 'Cannot', color: 'bg-red-500' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedStatus(opt.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold text-white ${opt.color} ${selectedStatus === opt.key ? 'ring-2 ring-offset-2 ring-offset-white ring-blue-200' : ''
                    }`}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedStatus(null)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 dark:text-slate-100 dark:bg-slate-900 dark:border-slate-700 ${selectedStatus === null ? 'ring-2 ring-offset-2 ring-blue-200' : ''
                  }`}
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={() => selectedDate && handleStatusChange(selectedDate, selectedStatus)}
              disabled={!selectedDate || updating || !isInTripRange(selectedDate)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Saving...' : 'Save'}
            </button>
            {selectedDate && (
              <div className="text-sm text-gray-700 dark:text-slate-200">
                Current status:{' '}
                <span className="font-semibold">
                  {getUserStatus(selectedDate) || 'Not set'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t pt-4 dark:border-slate-700 space-y-3">
          <h4 className="text-md font-semibold text-gray-900 dark:text-slate-100">Apply to date range</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block">Start date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                min={minDate.toISOString().split('T')[0]}
                max={maxDate.toISOString().split('T')[0]}
                value={rangeStart ? rangeStart.toISOString().split('T')[0] : ''}
                onChange={(e) => setRangeStart(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-200 block">End date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                min={minDate.toISOString().split('T')[0]}
                max={maxDate.toISOString().split('T')[0]}
                value={rangeEnd ? rangeEnd.toISOString().split('T')[0] : ''}
                onChange={(e) => setRangeEnd(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyRangeStatus}
            disabled={updating || !rangeStart || !rangeEnd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Applying...' : 'Apply status to range'}
          </button>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Applies the selected status to every date in the chosen range (max {MAX_DAYS} days).
          </p>
        </div>

        {selectedDate && (
          <div className="mt-4 border-t pt-4 dark:border-slate-700">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
              Group responses for {selectedDate.toLocaleDateString()}
            </h4>
            <div className="grid md:grid-cols-2 gap-2">
              {getDateStatuses(selectedDate).map(({ member, status }) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between border rounded-lg px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="text-sm text-gray-800 dark:text-slate-100">{member.name}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(
                      status,
                      true,
                    )}`}
                  >
                    {status || 'Not set'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg shadow-md p-6 border border-transparent dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
            <span className="text-sm">Can Go</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-white font-bold">?</div>
            <span className="text-sm">Maybe</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center text-white font-bold">✗</div>
            <span className="text-sm">Cannot Go</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white border-2 border-gray-300 dark:bg-slate-900 dark:border-slate-700" />
            <span className="text-sm">Not Set</span>
          </div>
        </div>
      </div>
    </div>
  );
}
