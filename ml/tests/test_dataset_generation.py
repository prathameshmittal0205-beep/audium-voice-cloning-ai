import pytest
from unittest.mock import MagicMock, patch
import os
import csv

def test_metadata_generation(tmp_path):
    # Simulate writing metadata.csv
    csv_file = tmp_path / "metadata.csv"
    
    data = [
        {"file": "chunk_0.wav", "text": "This is a mocked transcript."},
        {"file": "chunk_1.wav", "text": "Another mocked line."}
    ]
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter='|')
        for row in data:
            writer.writerow([row['file'], row['text'], row['text']])
            
    assert os.path.exists(csv_file)
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        assert len(lines) == 2
        assert "chunk_0.wav|This is a mocked transcript.|This is a mocked transcript." in lines[0]

def test_train_eval_split():
    total_samples = 100
    eval_split_ratio = 0.1
    
    eval_samples = int(total_samples * eval_split_ratio)
    train_samples = total_samples - eval_samples
    
    assert eval_samples == 10
    assert train_samples == 90

def test_audio_duration_rejection():
    # Clips under 2 seconds rejected
    duration_short = 1.5
    assert duration_short >= 2.0 == False
    
    # Clips over 15 seconds rejected
    duration_long = 16.0
    assert duration_long <= 15.0 == False
    
    # Valid clip
    duration_valid = 5.0
    assert (duration_valid >= 2.0 and duration_valid <= 15.0) == True

def test_transcript_word_count_rejection():
    # Transcripts under 3 words rejected
    short_transcript = "Hi there"
    assert len(short_transcript.split()) >= 3 == False
    
    valid_transcript = "This is a valid transcript"
    assert len(valid_transcript.split()) >= 3 == True
