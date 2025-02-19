import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import React from 'react';
import Select, {
  components,
  SingleValueProps,
  SingleValue,
} from 'react-select';

import './App.css';

type LogEntry = {
  datetime: string;
  description: string;
  hours: number;
};

function App() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(0);
  const [logentries_db, setLogEntriesDb] = useState<Database | null>(null);

  useEffect(() => {
    async function initDatabase() {
      try {
        const db = await Database.load('sqlite:tagalog_entries.db');
        setLogEntriesDb(db);

        await db.execute(`
          CREATE TABLE IF NOT EXISTS log_entries (
            datetime TEXT, 
            hours NUMERIC(4,1), 
            description TEXT
          );
        `);

        const rows: LogEntry[] = await db.select(
          'SELECT datetime, hours, description FROM log_entries'
        );

        console.log('rows=', rows);
        setLogEntries(rows);
      } catch (error) {
        console.error('Database error:', error);
      }
    }

    initDatabase();
  }, []);

  interface OptionType {
    value: string;
    label: string;
  }
  const SingleValue = ({
    children,
    ...props
  }: SingleValueProps<OptionType>) => (
    <components.SingleValue {...props}>
      {String(children)
        .split('\n')
        .map((line, index) => (
          <React.Fragment key={index}>
            {line}
            <br />
          </React.Fragment>
        ))}
    </components.SingleValue>
  );

  const sortByFrequency = (arr: LogEntry[]) => {
    // Sorty by frequency and remove duplicates
    const frequencyMap = arr.reduce<Record<string, number>>((acc, obj) => {
      acc[obj.description] = (acc[obj.description] || 0) + 1;
      return acc;
    }, {});

    const sortedByFrequency = [...arr].sort(
      (a, b) => frequencyMap[b.description] - frequencyMap[a.description]
    );
    const seen = new Set<string>();
    return sortedByFrequency.filter((obj) => {
      if (seen.has(obj.description)) return false;
      seen.add(obj.description);
      return true;
    });
  };

  const LogEntryAutoCompleteWidget = () => (
    <Select
      options={sortByFrequency(logEntries).map((option) => ({
        value: option.description,
        label: option.description,
      }))}
      components={{ SingleValue }}
      onChange={(e) => {
        const selected = e as SingleValue<{ value: string; label: string }>;
        if (selected == null) {
          return;
        }
        console.log(e);
        setDescription(selected.value);
      }}
      placeholder="Search..."
    />
    // TODO: The search doesn't handle multiple words as well as it could
  );

  const log_to_db = async () => {
    console.log('Hours:', hours);
    console.log('Description:', description);

    if (logentries_db == null) throw new Error('db was unexpectedly null');

    try {
      await logentries_db.execute(
        'INSERT INTO log_entries(description, datetime, hours) VALUES ($1, CURRENT_TIMESTAMP, $2)',
        [description, hours]
      );

      setLogEntries((prevEntries) => [
        ...prevEntries,
        {
          datetime: new Date().toISOString(),
          description,
          hours,
        },
      ]);

      console.log('Log entry added successfully!');
    } catch (error) {
      console.error('Error inserting log entry:', error);
    }
  };

  return (
    <main className="container">
      <h1>TagaLog time tracker</h1>

      <form>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          cols={40}
          style={{ marginTop: '10px', width: '100%', whiteSpace: 'pre-wrap' }}
        />
        Hours:{' '}
        <input onChange={(e) => setHours(parseFloat(e.target.value))}></input>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault();
            log_to_db();
          }}
        >
          Log
        </button>
        <br />
        &nbsp;
        <br />
        <LogEntryAutoCompleteWidget />
      </form>
    </main>
  );
}

export default App;
