"""
PersonalCookingRecipe API Basic Tests
FastAPI application testing module

@author: API Developer
@version: 1.0.0
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestAPISetup:
    """Basic API setup tests"""

    def test_python_version(self):
        """Test that Python version is 3.8+"""
        assert sys.version_info >= (3, 8), "Python 3.8+ required"

    def test_fastapi_import(self):
        """Test that FastAPI can be imported"""
        try:
            from fastapi import FastAPI
            assert FastAPI is not None
        except ImportError as e:
            pytest.fail(f"FastAPI import failed: {e}")

    def test_pydantic_import(self):
        """Test that Pydantic can be imported"""
        try:
            from pydantic import BaseModel
            assert BaseModel is not None
        except ImportError as e:
            pytest.fail(f"Pydantic import failed: {e}")


class TestAPIModels:
    """Test API model imports"""

    def test_models_directory_exists(self):
        """Test that models directory exists"""
        models_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'models'
        )
        assert os.path.isdir(models_path), "models directory should exist"

    def test_services_directory_exists(self):
        """Test that services directory exists"""
        services_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'services'
        )
        assert os.path.isdir(services_path), "services directory should exist"


class TestMainModule:
    """Test main.py module"""

    def test_main_file_exists(self):
        """Test that main.py exists"""
        main_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'main.py'
        )
        assert os.path.isfile(main_path), "main.py should exist"

    def test_main_is_readable(self):
        """Test that main.py is readable"""
        main_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'main.py'
        )
        with open(main_path, 'r') as f:
            content = f.read()
        assert len(content) > 0, "main.py should have content"
        assert 'FastAPI' in content, "main.py should contain FastAPI"


class TestEnvironmentSetup:
    """Test environment configuration"""

    def test_env_example_exists(self):
        """Test that .env.example exists"""
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            '.env.example'
        )
        assert os.path.isfile(env_path), ".env.example should exist"

    def test_requirements_exists(self):
        """Test that requirements.txt exists"""
        req_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'requirements.txt'
        )
        assert os.path.isfile(req_path), "requirements.txt should exist"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
