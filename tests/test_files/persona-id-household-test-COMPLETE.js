/**
 * COMPLETE PERSONA_PAYLOAD mock data for Identity Verification in Household Tests
 * This payload includes ALL fields from real Persona API responses
 * Adapted from example-persona.txt with full structure and all 32 verification checks
 * 
 * Used for testing co-applicant flag attribution and household status transitions
 * in co_app_household_with_flag_errors.spec.js
 */

/**
 * Generate COMPLETE PERSONA_PAYLOAD for Primary Applicant (Name Match - PASSES)
 * @param {Object} userData - User data with first_name, last_name, email
 * @returns {Object} PERSONA_PAYLOAD structure with ALL fields
 */
export const getPrimaryPersonaPayload = (userData = {}) => {
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const getDates = () => {
        const currentDate = new Date();
        const dateAfter2Years = new Date(currentDate);
        dateAfter2Years.setFullYear(currentDate.getFullYear() + 2);
        
        const dateBefore1Year = new Date(currentDate);
        dateBefore1Year.setFullYear(currentDate.getFullYear() - 1);
        
        const dateBefore20Years = new Date(currentDate);
        dateBefore20Years.setFullYear(currentDate.getFullYear() - 20);
        
        const subMinutes = (mins) => {
            const date = new Date(currentDate);
            date.setMinutes(currentDate.getMinutes() - mins);
            return date;
        };
        
        return {
            dateAfter2Years,
            dateBefore1Year,
            dateBefore20Years,
            currentDate,
            subMinutes
        };
    };

    const { subMinutes, dateAfter2Years, dateBefore1Year, dateBefore20Years } = getDates();
    
    // Extract user data with defaults
    const firstName = userData.first_name || "Primary";
    const lastName = userData.last_name || "Applicant";
    
    // IDs
    const inqId = generateUUID();
    const accId = generateUUID();
    const inqTempId = generateUUID();
    const inqTempVerId = generateUUID();
    const werRunId = generateUUID();
    const verGovId = generateUUID();
    const inqSessionId = generateUUID();
    const docId = generateUUID();
    const verTempVerId = generateUUID();
    const verTempId = generateUUID();
    const deviceId = generateUUID();
    const netId = generateUUID();

    return {
        "data": {
            "type": "inquiry",
            "id": inqId,
            "attributes": {
                "status": "approved",
                "reference_id": null,
                "note": null,
                "behaviors": {
                    "api_version_less_than_minimum_count": 0,
                    "autofill_cancels": 0,
                    "autofill_starts": 0,
                    "behavior_threat_level": "low",
                    "bot_score": 1,
                    "completion_time": 14.491707147,
                    "debugger_attached": false,
                    "devtools_open": false,
                    "distraction_events": 0,
                    "hesitation_baseline": 0,
                    "hesitation_count": 0,
                    "hesitation_percentage": null,
                    "hesitation_time": 0,
                    "mobile_sdk_version_less_than_minimum_count": 0,
                    "request_spoof_attempts": 0,
                    "shortcut_copies": 0,
                    "shortcut_pastes": 0,
                    "user_agent_spoof_attempts": 0
                },
                "tags": [],
                "creator": "API",
                "reviewer_comment": null,
                "updated_at": subMinutes(5).toISOString(),
                "created_at": subMinutes(10).toISOString(),
                "started_at": subMinutes(9).toISOString(),
                "expires_at": null,
                "completed_at": subMinutes(6).toISOString(),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": subMinutes(5).toISOString(),
                "expired_at": null,
                "redacted_at": null,
                "previous_step_name": "verification_government_id",
                "next_step_name": "success",
                "name_first": firstName,
                "name_middle": null,
                "name_last": lastName,
                "birthdate": dateBefore20Years.toISOString().split('T')[0],
                "address_street_1": "123 TEST STREET",
                "address_street_2": null,
                "address_city": "TEST CITY",
                "address_subdivision": "Texas",
                "address_subdivision_abbr": "TX",
                "address_postal_code": "12345",
                "address_postal_code_abbr": "12345",
                "identification_number": "I1234562",
                "fields": {
                    "name_first": {
                        "type": "string",
                        "value": firstName
                    },
                    "name_middle": {
                        "type": "string",
                        "value": null
                    },
                    "name_last": {
                        "type": "string",
                        "value": lastName
                    },
                    "address_street_1": {
                        "type": "string",
                        "value": "123 TEST STREET"
                    },
                    "address_street_2": {
                        "type": "string",
                        "value": null
                    },
                    "address_city": {
                        "type": "string",
                        "value": "TEST CITY"
                    },
                    "address_subdivision": {
                        "type": "string",
                        "value": "TX"
                    },
                    "address_postal_code": {
                        "type": "string",
                        "value": "12345"
                    },
                    "address_country_code": {
                        "type": "string",
                        "value": "US"
                    },
                    "birthdate": {
                        "type": "date",
                        "value": dateBefore20Years.toISOString().split('T')[0]
                    },
                    "identification_number": {
                        "type": "string",
                        "value": "I1234562"
                    }
                }
            },
            "relationships": {
                "account": {
                    "data": {
                        "type": "account",
                        "id": accId
                    }
                },
                "template": {
                    "data": null
                },
                "inquiry_template": {
                    "data": {
                        "type": "inquiry-template",
                        "id": inqTempId
                    }
                },
                "inquiry_template_version": {
                    "data": {
                        "type": "inquiry-template-version",
                        "id": inqTempVerId
                    }
                },
                "transaction": {
                    "data": null
                },
                "reviewer": {
                    "data": {
                        "type": "workflow-run",
                        "id": werRunId
                    }
                },
                "reports": {
                    "data": []
                },
                "verifications": {
                    "data": [
                        {
                            "type": "verification/government-id",
                            "id": verGovId
                        }
                    ]
                },
                "sessions": {
                    "data": [
                        {
                            "type": "inquiry-session",
                            "id": inqSessionId
                        }
                    ]
                },
                "documents": {
                    "data": [
                        {
                            "type": "document/government-id",
                            "id": docId
                        }
                    ]
                },
                "selfies": {
                    "data": []
                }
            }
        },
        "included": [
            {
                "type": "verification/government-id",
                "id": verGovId,
                "attributes": {
                    "status": "passed",
                    "created_at": subMinutes(9).toISOString(),
                    "created_at_ts": Math.floor(subMinutes(9).getTime() / 1000),
                    "submitted_at": subMinutes(9).toISOString(),
                    "submitted_at_ts": Math.floor(subMinutes(9).getTime() / 1000),
                    "completed_at": subMinutes(6).toISOString(),
                    "completed_at_ts": Math.floor(subMinutes(6).getTime() / 1000),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "entity_confidence_score": 100,
                    "entity_confidence_reasons": ["generic"],
                    "front_photo_url": "https://files.withpersona.com/passport.jpg",
                    "back_photo_url": "https://files.withpersona.com/passport.jpg",
                    "photo_urls": [
                        {
                            "page": "front",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": ["https://files.withpersona.com/passport.jpg"],
                            "byte_size": 313714
                        },
                        {
                            "page": "back",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": ["https://files.withpersona.com/passport.jpg"],
                            "byte_size": 313714
                        }
                    ],
                    "selfie_photo": {
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 313714
                    },
                    "selfie_photo_url": "https://files.withpersona.com/selfie_photo.jpg",
                    "video_url": null,
                    "id_class": "dl",
                    "capture_method": "upload",
                    "name_first": firstName,
                    "name_middle": null,
                    "name_last": lastName,
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET",
                    "address_street_2": null,
                    "address_city": "TEST CITY",
                    "address_subdivision": "TX",
                    "address_postal_code": "12345",
                    "issuing_authority": "TX",
                    "issue_date": dateBefore1Year.toISOString().split('T')[0],
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0],
                    "endorsements": null,
                    "sex": "Female",
                    "restrictions": null,
                    "vehicle_class": "A",
                    "identification_number": "I1234562",
                    "from_reusable_persona": false,
                    "checks": [
                        {
                            "name": "id_aamva_database_lookup",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_account_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_attribute_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_blur_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_color_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_compromised_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_damaged_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_disallowed_country_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "selected_country_code": null
                            }
                        },
                        {
                            "name": "id_disallowed_type_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "detected_id_class": null,
                                "detected_id_designations": null,
                                "disallowed_id_designations": null,
                                "selected_id_classes": null
                            }
                        },
                        {
                            "name": "id_double_side_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_electronic_replica_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_entity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_experimental_model_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_expired_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_extracted_properties_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_extraction_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": {
                                "check_requirements": []
                            }
                        },
                        {
                            "name": "id_fabrication_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_glare_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_handwriting_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inconsistent_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inquiry_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_number_format_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_paper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_physical_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_po_box_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_clarity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_public_figure_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_real_id_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_selfie_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_unprocessable_submission_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_valid_dates_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_video_quality_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        }
                    ]
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/government-id",
                            "id": verTempId
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/government-id",
                            "id": verTempVerId
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "document": {
                        "data": {
                            "type": "document/government-id",
                            "id": docId
                        }
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": accId
                            }
                        ]
                    }
                }
            },
            {
                "type": "inquiry-session",
                "id": inqSessionId,
                "attributes": {
                    "status": "active",
                    "created_at": subMinutes(10).toISOString(),
                    "started_at": subMinutes(10).toISOString(),
                    "expired_at": null,
                    "ip_address": "186.52.241.202",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "os_name": "Windows",
                    "os_full_version": "10",
                    "device_type": "desktop",
                    "device_name": null,
                    "browser_name": "Chrome",
                    "browser_full_version": "139.0.7258.5",
                    "mobile_sdk_name": null,
                    "mobile_sdk_full_version": null,
                    "device_handoff_method": null,
                    "is_proxy": false,
                    "is_tor": false,
                    "is_datacenter": false,
                    "is_vpn": false,
                    "threat_level": "low",
                    "country_code": "US",
                    "country_name": "United States",
                    "region_code": "CA",
                    "region_name": "California",
                    "latitude": 37.751,
                    "longitude": -97.822,
                    "gps_latitude": 37.751,
                    "gps_longitude": -97.822,
                    "gps_precision": null,
                    "ip_connection_type": "residential",
                    "ip_isp": "Service Provider",
                    "network_organization": "Digital Ocean"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "device": {
                        "data": {
                            "type": "device",
                            "id": deviceId
                        }
                    },
                    "network": {
                        "data": {
                            "type": "network",
                            "id": netId
                        }
                    }
                }
            },
            {
                "type": "document/government-id",
                "id": docId,
                "attributes": {
                    "status": "processed",
                    "created_at": subMinutes(9).toISOString(),
                    "processed_at": subMinutes(6).toISOString(),
                    "processed_at_ts": Math.floor(subMinutes(6).getTime() / 1000),
                    "front_photo": {
                        "filename": "id_front.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 313714
                    },
                    "back_photo": {
                        "filename": "id_back.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 313714
                    },
                    "selfie_photo": {
                        "filename": "selfie_photo.jpg",
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 313714
                    },
                    "id_class": "dl",
                    "name_first": firstName,
                    "name_middle": null,
                    "name_last": lastName,
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET",
                    "address_street_2": null,
                    "address_city": "TEST CITY",
                    "address_subdivision": "TX",
                    "address_postal_code": "12345",
                    "issuing_authority": "TX",
                    "issue_date": dateBefore1Year.toISOString().split('T')[0],
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0],
                    "designations": null,
                    "sex": "Female",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": "A",
                    "identification_number": "I1234562"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "document_files": {
                        "data": []
                    }
                }
            },
            {
                "type": "inquiry-template",
                "id": inqTempId,
                "attributes": {
                    "status": "active",
                    "name": "Government ID (Household Test)",
                    "embedded_flow_domain_allowlist": [],
                    "hosted_flow_subdomains": [],
                    "hosted_flow_redirect_uri_schemes": []
                },
                "relationships": {
                    "latest_published_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    }
                }
            }
        ]
    };
};

/**
 * Generate COMPLETE PERSONA_PAYLOAD for Co-Applicant with Name Mismatch (TRIGGERS FLAG)
 * @param {Object} userData - User data with first_name, last_name, email (not used - completely different name)
 * @returns {Object} PERSONA_PAYLOAD structure with completely different name to trigger flag
 */
export const getCoApplicantPersonaPayloadMismatch = (userData = {}) => {
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const getDates = () => {
        const currentDate = new Date();
        const dateAfter2Years = new Date(currentDate);
        dateAfter2Years.setFullYear(currentDate.getFullYear() + 2);
        
        const dateBefore1Year = new Date(currentDate);
        dateBefore1Year.setFullYear(currentDate.getFullYear() - 1);
        
        const dateBefore20Years = new Date(currentDate);
        dateBefore20Years.setFullYear(currentDate.getFullYear() - 20);
        
        const subMinutes = (mins) => {
            const date = new Date(currentDate);
            date.setMinutes(currentDate.getMinutes() - mins);
            return date;
        };
        
        return {
            dateAfter2Years,
            dateBefore1Year,
            dateBefore20Years,
            currentDate,
            subMinutes
        };
    };

    const { subMinutes, dateAfter2Years, dateBefore1Year, dateBefore20Years } = getDates();
    
    // Use completely different name to trigger flag (score must be ≤ 30 for CRITICAL)
    const firstName = "Maria";
    const lastName = "Dominguez";
    
    // IDs
    const inqId = generateUUID();
    const accId = generateUUID();
    const inqTempId = generateUUID();
    const inqTempVerId = generateUUID();
    const werRunId = generateUUID();
    const verGovId = generateUUID();
    const inqSessionId = generateUUID();
    const docId = generateUUID();
    const verTempVerId = generateUUID();
    const verTempId = generateUUID();
    const deviceId = generateUUID();
    const netId = generateUUID();

    return {
        "data": {
            "type": "inquiry",
            "id": inqId,
            "attributes": {
                "status": "approved",
                "reference_id": null,
                "note": null,
                "behaviors": {
                    "api_version_less_than_minimum_count": 0,
                    "autofill_cancels": 0,
                    "autofill_starts": 0,
                    "behavior_threat_level": "low",
                    "bot_score": 1,
                    "completion_time": 14.491707147,
                    "debugger_attached": false,
                    "devtools_open": false,
                    "distraction_events": 0,
                    "hesitation_baseline": 0,
                    "hesitation_count": 0,
                    "hesitation_percentage": null,
                    "hesitation_time": 0,
                    "mobile_sdk_version_less_than_minimum_count": 0,
                    "request_spoof_attempts": 0,
                    "shortcut_copies": 0,
                    "shortcut_pastes": 0,
                    "user_agent_spoof_attempts": 0
                },
                "tags": [],
                "creator": "API",
                "reviewer_comment": null,
                "updated_at": subMinutes(5).toISOString(),
                "created_at": subMinutes(10).toISOString(),
                "started_at": subMinutes(9).toISOString(),
                "expires_at": null,
                "completed_at": subMinutes(6).toISOString(),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": subMinutes(5).toISOString(),
                "expired_at": null,
                "redacted_at": null,
                "previous_step_name": "verification_government_id",
                "next_step_name": "success",
                "name_first": firstName,
                "name_middle": null,
                "name_last": lastName,
                "birthdate": dateBefore20Years.toISOString().split('T')[0],
                "address_street_1": "456 MISMATCH STREET",
                "address_street_2": null,
                "address_city": "MISMATCH CITY",
                "address_subdivision": "Texas",
                "address_subdivision_abbr": "TX",
                "address_postal_code": "54321",
                "address_postal_code_abbr": "54321",
                "identification_number": "G7654321",
                "fields": {
                    "name_first": {
                        "type": "string",
                        "value": firstName
                    },
                    "name_middle": {
                        "type": "string",
                        "value": null
                    },
                    "name_last": {
                        "type": "string",
                        "value": lastName
                    },
                    "address_street_1": {
                        "type": "string",
                        "value": "456 MISMATCH STREET"
                    },
                    "address_street_2": {
                        "type": "string",
                        "value": null
                    },
                    "address_city": {
                        "type": "string",
                        "value": "MISMATCH CITY"
                    },
                    "address_subdivision": {
                        "type": "string",
                        "value": "TX"
                    },
                    "address_postal_code": {
                        "type": "string",
                        "value": "54321"
                    },
                    "address_country_code": {
                        "type": "string",
                        "value": "US"
                    },
                    "birthdate": {
                        "type": "date",
                        "value": dateBefore20Years.toISOString().split('T')[0]
                    },
                    "identification_number": {
                        "type": "string",
                        "value": "G7654321"
                    }
                }
            },
            "relationships": {
                "account": {
                    "data": {
                        "type": "account",
                        "id": accId
                    }
                },
                "template": {
                    "data": null
                },
                "inquiry_template": {
                    "data": {
                        "type": "inquiry-template",
                        "id": inqTempId
                    }
                },
                "inquiry_template_version": {
                    "data": {
                        "type": "inquiry-template-version",
                        "id": inqTempVerId
                    }
                },
                "transaction": {
                    "data": null
                },
                "reviewer": {
                    "data": {
                        "type": "workflow-run",
                        "id": werRunId
                    }
                },
                "reports": {
                    "data": []
                },
                "verifications": {
                    "data": [
                        {
                            "type": "verification/government-id",
                            "id": verGovId
                        }
                    ]
                },
                "sessions": {
                    "data": [
                        {
                            "type": "inquiry-session",
                            "id": inqSessionId
                        }
                    ]
                },
                "documents": {
                    "data": [
                        {
                            "type": "document/government-id",
                            "id": docId
                        }
                    ]
                },
                "selfies": {
                    "data": []
                }
            }
        },
        "included": [
            {
                "type": "verification/government-id",
                "id": verGovId,
                "attributes": {
                    "status": "passed",
                    "created_at": subMinutes(9).toISOString(),
                    "created_at_ts": Math.floor(subMinutes(9).getTime() / 1000),
                    "submitted_at": subMinutes(9).toISOString(),
                    "submitted_at_ts": Math.floor(subMinutes(9).getTime() / 1000),
                    "completed_at": subMinutes(6).toISOString(),
                    "completed_at_ts": Math.floor(subMinutes(6).getTime() / 1000),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "entity_confidence_score": 100,
                    "entity_confidence_reasons": ["generic"],
                    "front_photo_url": "https://files.withpersona.com/passport.jpg",
                    "back_photo_url": "https://files.withpersona.com/passport.jpg",
                    "photo_urls": [
                        {
                            "page": "front",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": ["https://files.withpersona.com/passport.jpg"],
                            "byte_size": 313714
                        },
                        {
                            "page": "back",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": ["https://files.withpersona.com/passport.jpg"],
                            "byte_size": 313714
                        }
                    ],
                    "selfie_photo": {
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 313714
                    },
                    "selfie_photo_url": "https://files.withpersona.com/selfie_photo.jpg",
                    "video_url": null,
                    "id_class": "dl",
                    "capture_method": "upload",
                    "name_first": firstName,
                    "name_middle": null,
                    "name_last": lastName,
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "456 MISMATCH STREET",
                    "address_street_2": null,
                    "address_city": "MISMATCH CITY",
                    "address_subdivision": "TX",
                    "address_postal_code": "54321",
                    "issuing_authority": "TX",
                    "issue_date": dateBefore1Year.toISOString().split('T')[0],
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0],
                    "designations": null,
                    "sex": "Male",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": "A",
                    "identification_number": "G7654321",
                    "checks": [
                        {
                            "name": "id_aamva_database_lookup",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_account_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_age_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_attribute_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_barcode_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_blur_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_color_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_compromised_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_damaged_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_disallowed_country_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "selected_country_code": null
                            }
                        },
                        {
                            "name": "id_disallowed_type_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": {
                                "country_code": null,
                                "detected_id_class": null,
                                "detected_id_designations": null,
                                "disallowed_id_designations": null,
                                "selected_id_classes": null
                            }
                        },
                        {
                            "name": "id_double_side_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_electronic_replica_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_entity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_experimental_model_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_expired_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_extracted_properties_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_extraction_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": {
                                "check_requirements": []
                            }
                        },
                        {
                            "name": "id_fabrication_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_glare_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_handwriting_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inconsistent_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_inquiry_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_mrz_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_number_format_inconsistency_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_paper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_physical_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_po_box_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_clarity_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_portrait_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_public_figure_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_real_id_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_repeat_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_selfie_comparison",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "required",
                            "metadata": []
                        },
                        {
                            "name": "id_tamper_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_unprocessable_submission_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_valid_dates_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        },
                        {
                            "name": "id_video_quality_detection",
                            "status": "passed",
                            "reasons": [],
                            "requirement": "not_required",
                            "metadata": []
                        }
                    ]
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "verification_template": {
                        "data": {
                            "type": "verification-template/government-id",
                            "id": verTempId
                        }
                    },
                    "verification_template_version": {
                        "data": {
                            "type": "verification-template-version/government-id",
                            "id": verTempVerId
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "document": {
                        "data": {
                            "type": "document/government-id",
                            "id": docId
                        }
                    },
                    "accounts": {
                        "data": [
                            {
                                "type": "account",
                                "id": accId
                            }
                        ]
                    }
                }
            },
            {
                "type": "inquiry-session",
                "id": inqSessionId,
                "attributes": {
                    "status": "active",
                    "created_at": subMinutes(10).toISOString(),
                    "started_at": subMinutes(10).toISOString(),
                    "expired_at": null,
                    "ip_address": "186.52.241.202",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "os_name": "Windows",
                    "os_full_version": "10",
                    "device_type": "desktop",
                    "device_name": null,
                    "browser_name": "Chrome",
                    "browser_full_version": "139.0.7258.5",
                    "mobile_sdk_name": null,
                    "mobile_sdk_full_version": null,
                    "device_handoff_method": null,
                    "is_proxy": false,
                    "is_tor": false,
                    "is_datacenter": false,
                    "is_vpn": false,
                    "threat_level": "low",
                    "country_code": "US",
                    "country_name": "United States",
                    "region_code": "CA",
                    "region_name": "California",
                    "latitude": 37.751,
                    "longitude": -97.822,
                    "gps_latitude": 37.751,
                    "gps_longitude": -97.822,
                    "gps_precision": null,
                    "ip_connection_type": "residential",
                    "ip_isp": "Service Provider",
                    "network_organization": "Digital Ocean"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "device": {
                        "data": {
                            "type": "device",
                            "id": deviceId
                        }
                    },
                    "network": {
                        "data": {
                            "type": "network",
                            "id": netId
                        }
                    }
                }
            },
            {
                "type": "document/government-id",
                "id": docId,
                "attributes": {
                    "status": "processed",
                    "created_at": subMinutes(9).toISOString(),
                    "processed_at": subMinutes(6).toISOString(),
                    "processed_at_ts": Math.floor(subMinutes(6).getTime() / 1000),
                    "front_photo": {
                        "filename": "id_front.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 313714
                    },
                    "back_photo": {
                        "filename": "id_back.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 313714
                    },
                    "selfie_photo": {
                        "filename": "selfie_photo.jpg",
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 313714
                    },
                    "id_class": "dl",
                    "name_first": firstName,
                    "name_middle": null,
                    "name_last": lastName,
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "456 MISMATCH STREET",
                    "address_street_2": null,
                    "address_city": "MISMATCH CITY",
                    "address_subdivision": "TX",
                    "address_postal_code": "54321",
                    "issuing_authority": "TX",
                    "issue_date": dateBefore1Year.toISOString().split('T')[0],
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0],
                    "designations": null,
                    "sex": "Male",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": "A",
                    "identification_number": "G7654321"
                },
                "relationships": {
                    "inquiry": {
                        "data": {
                            "type": "inquiry",
                            "id": inqId
                        }
                    },
                    "transaction": {
                        "data": null
                    },
                    "template": {
                        "data": null
                    },
                    "inquiry_template_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    },
                    "inquiry_template": {
                        "data": {
                            "type": "inquiry-template",
                            "id": inqTempId
                        }
                    },
                    "document_files": {
                        "data": []
                    }
                }
            },
            {
                "type": "inquiry-template",
                "id": inqTempId,
                "attributes": {
                    "status": "active",
                    "name": "Government ID (Household Test)",
                    "embedded_flow_domain_allowlist": [],
                    "hosted_flow_subdomains": [],
                    "hosted_flow_redirect_uri_schemes": []
                },
                "relationships": {
                    "latest_published_version": {
                        "data": {
                            "type": "inquiry-template-version",
                            "id": inqTempVerId
                        }
                    }
                }
            }
        ]
    };
};

