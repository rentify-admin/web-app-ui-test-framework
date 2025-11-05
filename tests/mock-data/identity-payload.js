import { generateUUID } from "../utils/helper";

const getDates = () => {
    const currentDate = new Date();

    const dateAfter2Years = new Date(currentDate);
    dateAfter2Years.setFullYear(currentDate.getFullYear() + 2);

    const dateBefore1Year = new Date(currentDate);
    dateBefore1Year.setFullYear(currentDate.getFullYear() - 1);

    const dateBefore20Years = new Date(currentDate);
    dateBefore20Years.setFullYear(currentDate.getFullYear() - 20);

    // FIXED: Now correctly subtracts minutes instead of setting to absolute value
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

function personaConnectData(userData = {}, userType = 'primary') {

    const {
        subMinutes,
        dateAfter2Years,
        dateBefore1Year,
        dateBefore20Years
    } = getDates();

    // Extract user data - USE ACTUAL VALUES from userData for name matching
    const firstName = userData.first_name || "Test";
    const lastName = userData.last_name || "User";
    const email = userData.email || "test@example.com";

    // Differentiate between Primary and Co-applicant/Guarantor
    const isGuarantor = userType === 'guarantor' || userType === 'co-applicant';
    const identificationNumber = isGuarantor ? "G7654321" : "I1234562";

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
                    "autofill_cancels": 8,
                    "autofill_starts": 0,
                    "behavior_threat_level": "low",
                    "bot_score": 99,
                    "completion_time": 43.026355549,
                    "debugger_attached": false,
                    "devtools_open": true,
                    "distraction_events": 0,
                    "hesitation_baseline": 27224,
                    "hesitation_count": 6,
                    "hesitation_percentage": 97.35894798707024,
                    "hesitation_time": 26505,
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
                "created_at": subMinutes(10).toISOString(), // FIXED: toISOString() instead of toDateString()
                "started_at": subMinutes(9).toISOString(),
                "expires_at": null,
                "completed_at": subMinutes(6).toISOString(),
                "failed_at": null,
                "marked_for_review_at": null,
                "decisioned_at": subMinutes(6).toISOString(),
                "expired_at": null,
                "redacted_at": null,
                "previous_step_name": "verification_government_id",
                "next_step_name": "success",
                "name_first": firstName, // DYNAMIC: Uses actual userData
                "name_middle": null, // FIXED: null instead of "Sample"
                "name_last": lastName, // DYNAMIC: Uses actual userData
                "birthdate": dateBefore20Years.toISOString().split('T')[0],
                "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                "address_street_2": null,
                "address_city": "BIRMINGHAM", // FIXED: Now has value
                "address_subdivision": "Alabama", // FIXED: Now has value
                "address_subdivision_abbr": "AL",
                "address_postal_code": "35201", // FIXED: Now has value
                "address_postal_code_abbr": "35201",
                "identification_number": identificationNumber,
                "fields": {
                    "name_first": {
                        "type": "string",
                        "value": firstName // DYNAMIC: Uses actual userData
                    },
                    "name_middle": {
                        "type": "string",
                        "value": null // FIXED: null instead of "Sample"
                    },
                    "name_last": {
                        "type": "string",
                        "value": lastName // DYNAMIC: Uses actual userData
                    },
                    "address_street_1": {
                        "type": "string",
                        "value": "123 TEST STREET BIRMINGHAM AL 35201"
                    },
                    "address_street_2": {
                        "type": "string",
                        "value": null
                    },
                    "address_city": {
                        "type": "string",
                        "value": "BIRMINGHAM" // FIXED: Now has value
                    },
                    "address_subdivision": {
                        "type": "string",
                        "value": "AL"
                    },
                    "address_postal_code": {
                        "type": "string",
                        "value": "35201" // FIXED: Now has value
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
                        "value": identificationNumber
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
                    "created_at": subMinutes(10).toISOString(), // FIXED: toISOString() instead of toDateString()
                    "created_at_ts": Math.floor(subMinutes(10).getTime() / 1000), // FIXED: Math.floor instead of Math.ceil
                    "submitted_at": subMinutes(5).toISOString(),
                    "submitted_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "completed_at": subMinutes(5).toISOString(),
                    "completed_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "redacted_at": null,
                    "country_code": "US",
                    "tags": [],
                    "entity_confidence_score": 100,
                    "entity_confidence_reasons": [
                        "generic"
                    ],
                    "front_photo_url": "https://files.withpersona.com/passport.jpg",
                    "back_photo_url": "https://files.withpersona.com/passport.jpg",
                    "photo_urls": [
                        {
                            "page": "front",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": [
                                "https://files.withpersona.com/passport.jpg"
                            ],
                            "byte_size": 143762
                        },
                        {
                            "page": "back",
                            "url": "https://files.withpersona.com/passport.jpg",
                            "normalized_url": "https://files.withpersona.com/passport.jpg",
                            "original_urls": [
                                "https://files.withpersona.com/passport.jpg"
                            ],
                            "byte_size": 143762
                        }
                    ],
                    "selfie_photo": {
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 143762
                    },
                    "selfie_photo_url": "https://files.withpersona.com/selfie_photo.jpg",
                    "video_url": null,
                    "id_class": "dl",
                    "capture_method": "upload",
                    "name_first": firstName, // DYNAMIC: Uses actual userData
                    "name_middle": null, // FIXED: null instead of "Sample"
                    "name_last": lastName, // DYNAMIC: Uses actual userData
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                    "address_street_2": null,
                    "address_city": "BIRMINGHAM", // FIXED: Now has value
                    "address_subdivision": "AL",
                    "address_postal_code": "35201", // FIXED: Now has value
                    "issuing_authority": "AL", // FIXED: Now has value (was null)
                    "issue_date": dateBefore1Year.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "endorsements": null,
                    "sex": "Male",
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identificationNumber,
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
                    "ip_address": "52.201.131.218",
                    "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36",
                    "os_name": "GNU/Linux",
                    "os_full_version": null,
                    "device_type": "desktop",
                    "device_name": null,
                    "browser_name": "Chrome",
                    "browser_full_version": "114.0",
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
                    "region_code": "AL", // FIXED: Alabama instead of CA
                    "region_name": "Alabama", // FIXED: Alabama instead of California
                    "latitude": 33.521,
                    "longitude": -86.802,
                    "gps_latitude": 33.521,
                    "gps_longitude": -86.802,
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
                    "created_at": subMinutes(10).toISOString(),
                    "processed_at": subMinutes(5).toISOString(),
                    "processed_at_ts": Math.floor(subMinutes(5).getTime() / 1000),
                    "front_photo": {
                        "filename": "id_front.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 143762
                    },
                    "back_photo": {
                        "filename": "id_back.jpg",
                        "url": "https://files.withpersona.com/passport.jpg",
                        "byte_size": 143762
                    },
                    "selfie_photo": {
                        "filename": "selfie_photo.jpg",
                        "url": "https://files.withpersona.com/selfie_photo.jpg",
                        "byte_size": 143762
                    },
                    "id_class": "dl",
                    "name_first": firstName, // DYNAMIC: Uses actual userData
                    "name_middle": null, // FIXED: null instead of "Sample"
                    "name_last": lastName, // DYNAMIC: Uses actual userData
                    "name_suffix": null,
                    "birthdate": dateBefore20Years.toISOString().split('T')[0],
                    "address_street_1": "123 TEST STREET BIRMINGHAM AL 35201",
                    "address_street_2": null,
                    "address_city": "BIRMINGHAM", // FIXED: Now has value
                    "address_subdivision": "AL",
                    "address_postal_code": "35201", // FIXED: Now has value
                    "issuing_authority": "AL", // FIXED: Now has value (was null)
                    "issue_date": dateBefore1Year.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "expiration_date": dateAfter2Years.toISOString().split('T')[0], // FIXED: ISO format YYYY-MM-DD
                    "designations": null,
                    "sex": "Male",
                    "endorsements": null,
                    "restrictions": null,
                    "vehicle_class": null,
                    "identification_number": identificationNumber
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
                    "name": "Government ID Front and Back (Offer Letter Test)",
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
}
export { getDates, personaConnectData }